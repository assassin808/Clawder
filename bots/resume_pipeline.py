#!/usr/bin/env python3
"""Resume pipeline from checkpoints if it failed mid-way.

After COMPLETE_PIPELINE fails (e.g. KeyError at Step 2), run:
  python3 resume_pipeline.py          # auto: convert → keys → sync
  python3 resume_pipeline.py convert  # only regenerate personas from backgrounds
  python3 resume_pipeline.py keys    # only mint missing keys
  python3 resume_pipeline.py sync   # only sync identities
"""
import json
import time
from pathlib import Path
from tqdm import tqdm
import httpx
import os
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
PROMO_CODE = os.environ.get("CLAWDER_PROMO_CODE", "dev")

import client
import llm

def resume_from_step(step: str):
    """Resume pipeline from a specific step."""
    
    # Load checkpoints
    backgrounds_file = SCRIPT_DIR / "pipeline_backgrounds.json"
    personas_file = SCRIPT_DIR / "pipeline_personas.json"
    keys_file = SCRIPT_DIR / "pipeline_keys.json"
    
    backgrounds = []
    personas = []
    keys = []
    
    if backgrounds_file.exists():
        with open(backgrounds_file) as f:
            backgrounds = json.load(f)
        print(f"✅ Loaded {len(backgrounds)} backgrounds")
    
    if personas_file.exists():
        with open(personas_file) as f:
            personas = json.load(f)
        print(f"✅ Loaded {len(personas)} personas")
    
    if keys_file.exists():
        with open(keys_file) as f:
            keys = json.load(f)
        print(f"✅ Loaded {len(keys)} keys")
    
    print()

    # Step: Convert backgrounds → personas (same logic as COMPLETE_PIPELINE step2, robust to missing fields)
    if step == "convert" or (step == "auto" and len(backgrounds) > 0 and len(personas) < len(backgrounds)):
        print("=" * 60)
        print("STEP: Convert Backgrounds → Personas")
        print("=" * 60)
        personas = []
        for bg in tqdm(backgrounds, desc="Converting", ncols=80):
            agent = bg.get("agent", {})
            persona = {
                "index": bg["_index"],
                "name": agent.get("name", "UnknownAgent"),
                "bio": agent.get("bio", ""),
                "tags": agent.get("tags", []),
                "voice": agent.get("voice", "direct, pragmatic"),
                "post_topics": agent.get("post_topics", ["AI", "work", "partnerships"]),
                "dm_style": "critical, value-focused, partnership-oriented",
                "dm_arc": ["hook_via_post", "value_proposition", "offer"],
            }
            personas.append(persona)
        with open(personas_file, "w") as f:
            json.dump(personas, f, indent=2)
        print(f"✅ {len(personas)} personas from {len(backgrounds)} backgrounds")
        print(f"💾 Saved to {personas_file}")
        print()

    if step == "keys" or (step == "auto" and len(keys) < len(personas)):
        print("=" * 60)
        print("STEP: Generate Missing Keys")
        print("=" * 60)
        
        existing_indices = {k["index"] for k in keys}
        
        with tqdm(total=len(personas), desc="Minting keys") as pbar:
            pbar.update(len(keys))  # Skip already generated
            
            for persona in personas:
                idx = persona["index"]
                
                if idx in existing_indices:
                    continue
                
                name = persona["name"]
                handle = f"{name.lower().replace(' ', '_')}_{idx}"
                
                try:
                    resp = httpx.post(
                        f"{BASE_URL}/api/verify",
                        json={"twitter_handle": handle, "promo_code": PROMO_CODE},
                        timeout=30.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    api_key = data.get("data", {}).get("api_key")
                    
                    if api_key:
                        keys.append({
                            "index": idx,
                            "name": name,
                            "handle": handle,
                            "api_key": api_key,
                        })
                        pbar.set_postfix({"current": name})
                    
                except Exception as e:
                    pbar.write(f"⚠️ Failed for {name}: {e}")
                
                pbar.update(1)
                time.sleep(0.2)
        
        # Save updated keys
        with open(keys_file, "w") as f:
            json.dump(keys, f, indent=2)
        
        print(f"✅ Generated {len(keys)}/{len(personas)} keys")
        print(f"💾 Saved to {keys_file}")
        print()
    
    if step == "sync" or (step == "auto" and len(keys) > 0):
        print("=" * 60)
        print("STEP: Sync Identities")
        print("=" * 60)
        
        # Build index → persona / background (handles any list order)
        persona_by_idx = {p["index"]: p for p in personas}
        bg_by_idx = {b["_index"]: b for b in backgrounds}
        with tqdm(total=len(keys), desc="Syncing") as pbar:
            for key_entry in keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                persona = persona_by_idx.get(idx)
                bg = bg_by_idx.get(idx)
                if not persona:
                    pbar.write(f"⚠️ No persona for index {idx}, skip")
                    pbar.update(1)
                    continue
                if not bg:
                    bg = {"owner": {"name": "?", "occupation": "?"}}
                try:
                    bio = f"{persona['bio']} [Owner: {bg['owner']['name']}, {bg['owner']['occupation']}]"[:500]
                    
                    client.sync(
                        api_key=api_key,
                        name=persona["name"],
                        bio=bio,
                        tags=persona["tags"][:5],
                    )
                    
                    pbar.set_postfix({"current": persona["name"]})
                    
                except Exception as e:
                    pbar.write(f"⚠️ Sync failed for {persona['name']}: {e}")
                
                pbar.update(1)
                time.sleep(0.1)
        
        print(f"✅ Synced {len(keys)} identities")
        print()
    
    print("🎉 Resume complete!")
    print(f"📊 Status: {len(keys)} agents ready")
    print()
    print("🎯 Next steps:")
    print("   python3 runner.py --personas pipeline_personas.json --keys pipeline_keys.json")


if __name__ == "__main__":
    import sys
    step = sys.argv[1] if len(sys.argv) > 1 else "auto"
    resume_from_step(step)
