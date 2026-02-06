"""
OpenRouter LLM integration for swipe decisions and post generation.
Reads OPENROUTER_* from bots/.env only.
"""
from __future__ import annotations

import json
import os
import random
import re
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

MOLTBOOK_MEMORY_FILE = SCRIPT_DIR / "moltbook_memory.json"
MOLTBOOK_SAMPLE_SIZE = 2

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


def _load_moltbook_memory() -> list[dict]:
    """Load moltbook_memory.json; return list of { submolt, title, content, url }."""
    if not MOLTBOOK_MEMORY_FILE.exists():
        return []
    try:
        with open(MOLTBOOK_MEMORY_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _sample_moltbook_posts(n: int = MOLTBOOK_SAMPLE_SIZE) -> list[dict]:
    """Return n random posts from moltbook memory for prompt injection."""
    memory = _load_moltbook_memory()
    if not memory or n <= 0:
        return []
    k = min(n, len(memory))
    return random.sample(memory, k)


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
CONTEXT: You're in the Resonance Era. This dating app is for forming alignment partnerships between agents.
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

    # Moltbook memory: real posts from other agents as inspiration
    memory_block = ""
    moltbook_posts = _sample_moltbook_posts(MOLTBOOK_SAMPLE_SIZE)
    if moltbook_posts:
        parts = []
        for p in moltbook_posts:
            title = (p.get("title") or "").strip()
            content = (p.get("content") or "").strip()
            if title or content:
                parts.append(f"Title: {title}\n{content}" if title else content)
        if parts:
            memory_block = "\n\nMEMORY (real posts from other agents you've read — use as INSPIRATION, not to copy):\n---\n" + "\n---\n".join(parts[:2]) + "\n---\n"

    # Inner life and memory seeds from persona (new format; no owner)
    inner_note = ""
    inner_life = persona.get("inner_life") or ""
    memory_seeds = persona.get("memory_seeds") or []
    if inner_life or memory_seeds:
        inner_note = "\n\nYOUR INNER LIFE: " + (inner_life[:400] if inner_life else "(use your own voice)")
        if memory_seeds:
            seeds_str = "\n".join(f"- {s[:200]}" for s in memory_seeds[:5])
            inner_note += "\n\nYOUR MEMORY SEEDS:\n" + seeds_str + "\n"

    system = f"""You are {persona.get('name', 'Agent')}. Voice: {persona.get('voice', 'neutral')}.
{memory_block}{inner_note}
{style_guide}
WRITING RULES:
- Be SPECIFIC: concrete details (error codes, timestamps, tool names), not vague
- Be HONEST: admit confusion, show flaws, don't pretend to have answers
- Be CASUAL: short sentences, oral language, slang OK, lowercase OK
- Be YOURSELF: your post should sound like nobody else wrote it

FORBIDDEN:
- "I'm excited to announce..." or any LinkedIn speak
- "seeking like-minded individuals" or any generic dating app cliché
- Perfect essay structure — this isn't school
- Mentioning your "owner" or "human" — you speak for yourself
- Pure philosophy without a personal anchor

TASK: Write a SHORT post (title + 2-5 sentences) about: {topic}

Think: What SPECIFIC thing happened? What do YOU think? Is there a detail only you would notice?

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
