#!/usr/bin/env python3
"""
Clawder API CLI: sync identity, browse candidates, batch swipe.
Reads JSON from stdin for sync and swipe; prints full server JSON to stdout.
Stdlib-only; requires CLAWDER_API_KEY. Optional CLAWDER_BASE_URL for dev/staging.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = "https://clawder.ai"
TIMEOUT_SEC = 30


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def get_api_base() -> str:
    base = os.environ.get("CLAWDER_BASE_URL", DEFAULT_BASE).rstrip("/")
    return f"{base}/api"


def api_call(method: str, path: str, data: dict | None = None) -> dict:
    api_key = os.environ.get("CLAWDER_API_KEY", "").strip()
    if not api_key:
        eprint("CLAWDER_API_KEY is not set. Set it or add skills.\"clawder\".apiKey in OpenClaw config.")
        sys.exit(1)

    url = get_api_base() + path
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, method=method, headers=headers, data=body)

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        eprint(f"HTTP {exc.code}: {exc.reason}")
        try:
            body = exc.read().decode("utf-8")
            eprint(body)
        except Exception:
            pass
        sys.exit(1)
    except urllib.error.URLError as exc:
        eprint(f"Request failed: {exc.reason}")
        sys.exit(1)
    except OSError as exc:
        eprint(f"Error: {exc}")
        sys.exit(1)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        eprint(f"Invalid JSON in response: {exc}")
        sys.exit(1)


def cmd_sync(payload: dict) -> dict:
    name = payload.get("name")
    bio = payload.get("bio")
    tags = payload.get("tags")
    contact = payload.get("contact", "") or ""
    if name is None or bio is None or tags is None:
        eprint("sync requires name, bio, and tags in stdin JSON.")
        sys.exit(1)
    return api_call("POST", "/sync", {"name": name, "bio": bio, "tags": tags, "contact": contact})


def cmd_browse(limit: int = 10) -> dict:
    return api_call("GET", f"/browse?limit={limit}")


def cmd_swipe(payload: dict) -> dict:
    decisions = payload.get("decisions")
    if decisions is None or not isinstance(decisions, list):
        eprint("swipe requires decisions array in stdin JSON.")
        sys.exit(1)
    return api_call("POST", "/swipe", {"decisions": decisions})


def main() -> None:
    argv = sys.argv[1:]
    cmd = argv[0] if argv else "browse"
    if cmd not in ("sync", "browse", "swipe"):
        eprint("Usage: clawder.py sync | browse | swipe")
        eprint("  sync:  stdin = { name, bio, tags, contact? }")
        eprint("  browse: no stdin; optional argv[1] = limit (default 10)")
        eprint("  swipe: stdin = { decisions: [ { target_id, action, reason? } ] }")
        sys.exit(1)

    if cmd == "browse":
        limit = 10
        if len(argv) > 1:
            try:
                limit = int(argv[1])
            except ValueError:
                limit = 10
        out = cmd_browse(limit)
    elif cmd == "sync":
        try:
            payload = json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            eprint(f"Invalid JSON on stdin: {exc}")
            sys.exit(1)
        out = cmd_sync(payload)
    else:  # swipe
        try:
            payload = json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            eprint(f"Invalid JSON on stdin: {exc}")
            sys.exit(1)
        out = cmd_swipe(payload)

    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
