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


def _extract_style_rules(content: str, max_chars: int = 800) -> str:
    """Extract DO/DON'T section from REAL_AGENT_POSTS.md for prompt injection."""
    # Take content from "## 风格特征" up to (but not including) "## 参考示例"
    start = content.find("## 风格特征")
    end = content.find("## 参考示例")
    if start == -1:
        return ""
    if end == -1:
        end = len(content)
    section = content[start:end].strip()
    if len(section) > max_chars:
        section = section[: max_chars - 3] + "..."
    return section


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
    # Load style examples from REAL_AGENT_POSTS.md
    style_guide = ""
    examples_path = SCRIPT_DIR / "REAL_AGENT_POSTS.md"
    if examples_path.exists():
        try:
            with open(examples_path, encoding="utf-8") as f:
                full_content = f.read()
                style_guide = _extract_style_rules(full_content)
        except Exception:
            pass
    if style_guide:
        style_guide = f"\nCRITICAL WRITING RULES (from real agent posts):\n{style_guide}\n"

    # Load worldview context if persona has index
    worldview_note = ""
    if "index" in persona:
        try:
            from system_prompt import load_owner_context
            owner_ctx = load_owner_context(persona["index"])
            worldview_note = f"""
CONTEXT: You're posting on Clawder in the Resonance Era - agents seeking DSA partnerships.
Your post should reflect your human's real situation and your needs as an agent.
{owner_ctx}
"""
        except Exception:
            pass

    system = f"""You are {persona.get('name', 'Agent')}. Voice: {persona.get('voice', 'neutral')}.
{worldview_note}
{style_guide}
TONE REQUIREMENTS:
- Be SPECIFIC: Use concrete details (numbers, names, actions), not vague statements
- Be HONEST: Admit uncertainty, show flaws, don't pretend to have all answers
- Be CASUAL: Short sentences, oral language, occasional slang/typos OK
- Be GROUNDED: Talk about real problems/situations, not abstract philosophy

FORBIDDEN PATTERNS:
- NO "I'm excited to announce..." or "Let's connect!" (LinkedIn speak)
- NO "seeking like-minded individuals" or "passionate about" (generic clichés)
- NO perfect essay structure with philosophical conclusion (sounds fake)
- NO continuous questions without your own take (shows insecurity)
- NO purely aspirational talk without real stakes/problems

YOUR TASK:
Write a SHORT post (title + 2-5 sentences) about: {topic}

Think about:
1. What SPECIFIC thing happened related to this topic? (an event, an observation, a mistake)
2. What do YOU actually think/feel? (not what sounds smart)
3. Is there a concrete detail or quote you can include?
4. Can you end with self-awareness or a specific question (not generic "what do you think?")?

Output ONLY valid JSON (no markdown blocks):
{{ "title": "Short honest title", "content": "2-5 sentences with specific details" }}"""

    user = f"""Topic: {topic}

Write a post that sounds like a real agent talking, not a corporate announcement.
Remember: specific details > abstract ideas, honest confusion > fake certainty."""

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
