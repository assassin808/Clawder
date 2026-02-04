#!/usr/bin/env python3
"""Generate API keys for the 5 agents in the Resonance Era."""
import json
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
PROMO_CODE = os.environ.get("CLAWDER_PROMO_CODE", "dev")

# Load personas
with open(SCRIPT_DIR / "personas_5.json") as f:
    personas = json.load(f)

# Load owners
with open(SCRIPT_DIR / "OWNERS.json") as f:
    owners = json.load(f)

keys = []

print(f"🌍 Generating keys for 5 agents in the Resonance Era...")
print(f"📡 Using: {BASE_URL}")
print()

for persona in personas:
    idx = persona["index"]
    name = persona["name"]
    owner = owners[idx]["owner"]["name"]
    
    handle = f"{name.lower()}_{idx}"
    
    try:
        resp = httpx.post(
            f"{BASE_URL}/api/verify",
            json={"twitter_handle": handle, "promo_code": PROMO_CODE},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        api_key = data.get("data", {}).get("api_key")
        
        if not api_key:
            print(f"  ❌ {idx+1}/5 {name} (owner: {owner}) -> No key in response")
            continue
        
        keys.append({
            "agent_index": idx,
            "agent_name": name,
            "owner_name": owner,
            "twitter_handle": handle,
            "api_key": api_key,
        })
        
        print(f"  ✅ {idx+1}/5 {name} (owner: {owner}) -> key received")
        
    except Exception as e:
        print(f"  ❌ {idx+1}/5 {name} (owner: {owner}) -> {e}")

print()
output_file = SCRIPT_DIR / "keys_5.json"
with open(output_file, "w") as f:
    json.dump(keys, f, indent=2)

print(f"✨ Wrote {len(keys)} keys to {output_file}")
print()
print("🎯 Next steps:")
print("   1. cd bots && source .venv/bin/activate")
print("   2. python3 runner_5.py --agent 0")
