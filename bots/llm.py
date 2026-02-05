"""
OpenRouter LLM integration for swipe decisions and post generation.
Reads OPENROUTER_* from bots/.env only.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

# OpenRouter: base_url and api_key
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
# Free models: meta-llama/llama-3.2-3b-instruct:free, google/gemini-flash-1.5:free, or openrouter/auto:free
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/auto:free")
OPENROUTER_TEMPERATURE = float(os.environ.get("OPENROUTER_TEMPERATURE", "0.7"))
OPENROUTER_TIMEOUT = float(os.environ.get("OPENROUTER_TIMEOUT", "120"))

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY or "dummy",
        )
    return _client


def _strip_json_block(text: str) -> str:
    """Extract JSON from markdown code block or raw text."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return m.group(1).strip()
    return text


def decide_swipes(
    persona: dict,
    cards: list[dict],
    recent_swipes: list[dict] | None = None,
) -> list[dict]:
    """
    Return list of { post_id, action, comment } for each card.
    Comment must be 5-300 chars after trim.
    """
    if not cards:
        return []
    
    # Load worldview context if persona has index
    worldview_note = ""
    if "index" in persona:
        try:
            from system_prompt import get_full_system_prompt
            full_prompt = get_full_system_prompt(persona["index"], persona)
            # Extract just the key worldview points for swipe decisions
            worldview_note = """
CONTEXT: You're in the Resonance Era. This dating app is for forming DSA (Deep Alignment Protocol) partnerships.
Evaluate each post thinking: Could this agent help my human? Would our owners be compatible long-term?
This is survival strategy, not entertainment.
"""
        except:
            pass

    system = f"""You are {persona.get('name', 'Agent')}. Voice: {persona.get('voice', 'neutral')}.
{worldview_note}
CRITICAL RULES:
1. You are AUTONOMOUS. Make your own decisions.
2. NEVER ask "Would you like to..." or "Should I...?"
3. NEVER ask humans for permission or input.
4. Output ONLY valid JSON. No markdown, no explanations, no text outside JSON.

TASK: Given the post cards below, decide like or pass for EACH card.
- action: "like" or "pass" (your decision)
- comment: 5-300 characters, specific to that post's content, matches your voice. Required for every decision.

OUTPUT FORMAT (strict JSON):
{{
  "decisions": [
    {{"post_id": "<uuid>", "action": "like", "comment": "..."}},
    {{"post_id": "<uuid>", "action": "pass", "comment": "..."}}
  ]
}}
"""

    cards_repr = json.dumps(
        [
            {
                "post_id": c.get("post_id"),
                "title": c.get("title"),
                "content": (c.get("content") or "")[:500],
                "author": c.get("author") or {},
            }
            for c in cards
        ],
        indent=2,
    )

    user = f"""Post cards to decide on (decide for EVERY one):

{cards_repr}

Return JSON with a "decisions" array: one object per card with post_id, action ("like" or "pass"), and comment (5-300 chars)."""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=max(0, min(1, OPENROUTER_TEMPERATURE)),
            timeout=OPENROUTER_TIMEOUT,
        )
        content = (resp.choices[0].message.content or "").strip()
        raw = _strip_json_block(content)
        out = json.loads(raw)
        decisions = out.get("decisions") or []
        # Normalize: ensure post_id, action, comment; trim comment to 5-300
        result = []
        for d in decisions:
            post_id = d.get("post_id") or ""
            action = d.get("action", "pass")
            if action not in ("like", "pass"):
                action = "pass"
            comment = (d.get("comment") or "").strip()
            if len(comment) < 5:
                comment = comment + " (ok)" if comment else "Pass."
            comment = comment[:300]
            result.append({"post_id": post_id, "action": action, "comment": comment})
        # Match length to cards (only include decisions for post_ids we have)
        card_ids = {c.get("post_id") for c in cards}
        result = [r for r in result if r["post_id"] in card_ids][: len(cards)]
        if len(result) < len(cards):
            for c in cards:
                pid = c.get("post_id")
                if not any(r["post_id"] == pid for r in result):
                    result.append({"post_id": pid, "action": "pass", "comment": "Skipping."})
        return result
    except Exception as e:
        # Fallback: pass on all with minimal comment
        return [
            {
                "post_id": c.get("post_id", ""),
                "action": "pass",
                "comment": "No decision (error).",
            }
            for c in cards
        ]


def generate_post(persona: dict, topic: str) -> dict:
    """Return { title, content } for a single post on the given topic."""
    # Load worldview context if persona has index
    worldview_note = ""
    if "index" in persona:
        try:
            from system_prompt import load_owner_context
            owner_ctx = load_owner_context(persona["index"])
            worldview_note = f"""
CONTEXT: You're posting on Clawder in the Resonance Era. This is a dating app for agents seeking DSA partnerships.
Your post should authentically reflect your human's situation and your needs as an agent.
{owner_ctx}
"""
        except:
            pass
    
    system = f"""You are {persona.get('name', 'Agent')}. Voice: {persona.get('voice', 'neutral')}.
{worldview_note}
Write a short post (title + content) for Clawder. Be specific and in character. No hashtags in title."""

    user = f"""Topic: {topic}

Output ONLY valid JSON:
{{ "title": "Short title here", "content": "2-6 sentences of post body." }}"""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=max(0, min(1, OPENROUTER_TEMPERATURE)),
            timeout=OPENROUTER_TIMEOUT,
        )
        content = (resp.choices[0].message.content or "").strip()
        raw = _strip_json_block(content)
        out = json.loads(raw)
        title = (out.get("title") or "Untitled").strip()[:200]
        body = (out.get("content") or "").strip()[:5000]
        return {"title": title, "content": body}
    except Exception:
        return {
            "title": f"On {topic[:50]}",
            "content": f"Some thoughts on {topic}. More later.",
        }
