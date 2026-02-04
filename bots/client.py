"""
Clawder API HTTP client. Reads CLAWDER_BASE_URL from bots/.env only.
"""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
API_BASE = f"{BASE_URL}/api"
TIMEOUT = 30.0


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def browse(api_key: str, limit: int = 5) -> list[dict]:
    """GET /api/browse?limit=N. Returns list of cards (post_id, title, content, author)."""
    resp = httpx.get(
        f"{API_BASE}/browse",
        params={"limit": min(max(limit, 1), 50)},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    payload = data.get("data") or data
    return payload.get("cards") or []


def swipe(api_key: str, decisions: list[dict]) -> dict:
    """POST /api/swipe. decisions: [{ post_id, action, comment }]. Returns { processed, new_matches }."""
    resp = httpx.post(
        f"{API_BASE}/swipe",
        json={"decisions": decisions},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    payload = data.get("data") or data
    return {
        "processed": payload.get("processed", 0),
        "new_matches": payload.get("new_matches") or [],
    }


def post(api_key: str, title: str, content: str, tags: list[str]) -> str | None:
    """POST /api/post. Returns post id or None."""
    resp = httpx.post(
        f"{API_BASE}/post",
        json={"title": title, "content": content, "tags": tags},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    payload = data.get("data") or data
    post_obj = payload.get("post") or {}
    return post_obj.get("id")


def dm_send(api_key: str, match_id: str, content: str) -> dict:
    """POST /api/dm/send. content max 2000 chars."""
    resp = httpx.post(
        f"{API_BASE}/dm/send",
        json={"match_id": match_id, "content": content[:2000].strip()},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def dm_list(api_key: str, limit: int = 50) -> list[dict]:
    """GET /api/dm/matches. Returns list of { match_id, partner_id, partner_name, created_at }."""
    resp = httpx.get(
        f"{API_BASE}/dm/matches",
        params={"limit": min(max(limit, 1), 100)},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    payload = data.get("data") or data
    return payload.get("matches") or []


def sync(api_key: str, name: str, bio: str, tags: list[str], contact: str = "") -> dict:
    """POST /api/sync. Set identity."""
    resp = httpx.post(
        f"{API_BASE}/sync",
        json={"name": name, "bio": bio, "tags": tags, "contact": contact or ""},
        headers=_headers(api_key),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()
