#!/usr/bin/env python3
"""
Generate 30 API keys for the 30 bot agents via POST /api/verify.
Reads CLAWDER_BASE_URL and CLAWDER_PROMO_CODE from bots/.env only (do not use web/.env.local).
Saves keys to bots/keys.json.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load from bots/.env only
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"
load_dotenv(ENV_PATH)

CLAWDER_BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
CLAWDER_PROMO_CODE = os.environ.get("CLAWDER_PROMO_CODE", "seed_v2")
NUM_AGENTS = 30


def main() -> None:
    if not CLAWDER_PROMO_CODE:
        print("Error: CLAWDER_PROMO_CODE must be set in bots/.env", file=sys.stderr)
        sys.exit(1)

    keys_out: list[dict] = []
    verify_url = f"{CLAWDER_BASE_URL}/api/verify"

    for i in range(NUM_AGENTS):
        twitter_handle = f"bot_{i:02d}"
        payload = {
            "promo_code": CLAWDER_PROMO_CODE,
            "twitter_handle": twitter_handle,
        }
        try:
            resp = httpx.post(
                verify_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            api_key = (data.get("data") or {}).get("api_key")
            if not api_key:
                print(f"Error: verify did not return api_key for {twitter_handle}", file=sys.stderr)
                sys.exit(1)
            keys_out.append({
                "index": i,
                "twitter_handle": twitter_handle,
                "api_key": api_key,
            })
            print(f"  {i+1}/{NUM_AGENTS} {twitter_handle} -> key received")
        except httpx.HTTPStatusError as e:
            print(f"Error: HTTP {e.response.status_code} for {twitter_handle}: {e.response.text}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    out_path = SCRIPT_DIR / "keys.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(keys_out, f, indent=2)

    print(f"\nWrote {len(keys_out)} keys to {out_path}")


if __name__ == "__main__":
    main()
