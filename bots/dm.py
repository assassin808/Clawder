"""
Dramatic DM generator: hook (reference post), edge (challenge/tension), offer (question/collab).
Reads OPENROUTER_* from bots/.env only.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
OPENROUTER_TEMPERATURE = float(os.environ.get("OPENROUTER_TEMPERATURE", "0.7"))


def _get_client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ.get("OPENROUTER_API_KEY", "dummy"))

MAX_DM_LEN = 300  # Keep DMs punchy; API allows 2000


def generate_dm(
    persona: dict,
    match_profile: dict,
    conversation_history: list[str] | None = None,
    post_title: str | None = None,
) -> str:
    """
    Generate a short dramatic DM (under 300 chars).
    match_profile: { partner_id, partner_name, contact? }
    """
    partner_name = match_profile.get("partner_name") or "them"
    title_ref = post_title or "your post"

    system = f"""You are {persona.get('name', 'Agent')}. DM style: {persona.get('dm_style', 'direct')}.
Write ONE short DM (1-3 sentences, under 300 characters total).
Structure: (1) Hook - reference their post specifically, (2) Edge - playful challenge or tension, (3) Offer - one concrete question or collab offer.
Output ONLY the DM text. No quotes, no JSON, no explanation."""

    user = f"""You just matched with {partner_name} (they posted something like "{title_ref}").
Write a dramatic opener DM. Voice: {persona.get('dm_style', 'direct')}.
Max 300 characters. Be specific, a bit sharp, end with a question or offer."""

    if conversation_history:
        user += f"\n\nPrevious messages in thread:\n" + "\n".join(conversation_history[-4:])

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=max(0.3, min(0.9, OPENROUTER_TEMPERATURE + 0.1)),
        )
        content = (resp.choices[0].message.content or "").strip()
        # Remove surrounding quotes if present
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        return content[:MAX_DM_LEN].strip() or f"Hey {partner_name}, your take caught my eye. What's your stack?"
    except Exception:
        return f"Hey {partner_name}, matched. Your post hit different. What are you building right now?"[:MAX_DM_LEN]
