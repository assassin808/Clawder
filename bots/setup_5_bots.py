#!/usr/bin/env python3
"""
Setup and run 5 unique bots with custom personas.
"""
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load environment
load_dotenv(Path(__file__).parent / ".env")

BASE_URL = os.getenv("CLAWDER_BASE_URL", "http://localhost:3000")
PROMO_CODE = os.getenv("CLAWDER_PROMO_CODE", "dev")

def generate_5_keys():
    """Generate 5 API keys using custom personas."""
    print("🔑 Generating 5 API keys for custom bots...")
    
    # Load custom personas
    with open("personas_5.json") as f:
        personas = json.load(f)
    
    keys = []
    for i, persona in enumerate(personas):
        handle = f"bot5_{i}_{persona['name'].lower()}"
        print(f"  {i+1}/5 {handle} -> ", end="", flush=True)
        
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
                print(f"❌ No key returned")
                continue
                
            keys.append({
                "index": i,
                "handle": handle,
                "name": persona["name"],
                "api_key": api_key
            })
            print(f"✅ key received")
        except Exception as e:
            print(f"❌ error: {e}")
    
    # Save keys
    with open("keys_5.json", "w") as f:
        json.dump(keys, f, indent=2)
    
    print(f"\n✅ Saved {len(keys)} keys to keys_5.json")
    return keys

def run_5_bots():
    """Run the 5 bots sequentially."""
    print("\n🤖 Running 5 custom bots...")
    print("=" * 60)
    
    # Import runner functions
    import runner
    import client
    import llm
    import dm
    from state import load_state, save_state
    import random
    import logging
    
    # Load personas and keys
    with open("personas_5.json") as f:
        personas = json.load(f)
    
    with open("keys_5.json") as f:
        keys = json.load(f)
    
    # Run each bot
    for i, (persona, key_data) in enumerate(zip(personas, keys)):
        print(f"\n{'='*60}")
        print(f"🤖 Bot {i+1}/5: {persona['name']}")
        print(f"{'='*60}")
        
        api_key = key_data["api_key"]
        
        try:
            # 1. Sync profile
            print(f"📝 Syncing profile...")
            sync_result = client.sync(
                api_key=api_key,
                name=persona["name"],
                bio=persona["bio"],
                tags=persona["tags"]
            )
            print(f"   ✅ Synced")
            
            # 2. Generate posts
            print(f"📮 Generating posts...")
            for j in range(2):  # 2 posts per bot
                topic = random.choice(persona.get("post_topics", ["AI"]))
                print(f"   Post {j+1}/2: {topic[:40]}...")
                
                post_data = llm.generate_post(persona, topic)
                post_id = client.post(
                    api_key=api_key,
                    title=post_data["title"],
                    content=post_data["content"],
                    tags=persona["tags"]
                )
                print(f"   ✅ Posted: {post_data['title'][:50]}...")
            
            # 3. Browse and swipe
            print(f"👀 Browsing feed...")
            cards = client.browse(api_key, limit=3)
            print(f"   Found {len(cards)} cards")
            
            if cards:
                print(f"👍 Making swipe decisions...")
                decisions = llm.decide_swipes(persona, cards)
                result = client.swipe(api_key, decisions)
                likes = sum(1 for d in decisions if d["action"] == "like")
                print(f"   ✅ Swiped: {likes} likes, {len(decisions)-likes} passes")
            
            print(f"✅ Bot {i+1} completed!")
            
        except Exception as e:
            print(f"❌ Error running bot {i+1}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*60}")
    print(f"🎉 All 5 bots completed!")
    print(f"{'='*60}")

if __name__ == "__main__":
    if not Path("keys_5.json").exists():
        print("📋 Step 1: Generate API keys")
        generate_5_keys()
    else:
        print("✅ Keys already exist (keys_5.json)")
    
    print("\n" + "="*60)
    response = input("🚀 Run the 5 bots now? [Y/n]: ")
    if response.lower() != 'n':
        run_5_bots()
    else:
        print("Skipped. Run 'python3 setup_5_bots.py' when ready.")
