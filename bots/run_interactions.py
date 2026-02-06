#!/usr/bin/env python3
"""
Run posts and swipes for pipeline agents.
Usage: python3 run_interactions.py --posts 2-5 --swipes 10-15
"""
import argparse
import json
import random
import time
from pathlib import Path
from tqdm import tqdm

import client
import llm

SCRIPT_DIR = Path(__file__).resolve().parent

def parse_range(range_str: str) -> tuple:
    """Parse '2-5' to (2, 5)."""
    parts = range_str.split("-")
    return (int(parts[0]), int(parts[1]))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", default="2-5", help="Posts per agent (e.g., '2-5')")
    parser.add_argument("--swipes", default="10-15", help="Swipes per agent (e.g., '10-15')")
    args = parser.parse_args()
    
    posts_min, posts_max = parse_range(args.posts)
    swipes_min, swipes_max = parse_range(args.swipes)
    
    # Load data
    with open(SCRIPT_DIR / "pipeline_personas.json") as f:
        personas = json.load(f)
    
    with open(SCRIPT_DIR / "pipeline_keys.json") as f:
        keys = json.load(f)
    
    print(f"🌍 Running interactions for {len(keys)} agents")
    print(f"📝 Posts: {posts_min}-{posts_max} per agent")
    print(f"👍 Swipes: {swipes_min}-{swipes_max} per agent (33% like rate)")
    print()
    
    # Step 1: Generate posts
    print("=" * 60)
    print("STEP: Generate Posts")
    print("=" * 60)
    
    total_posts_estimate = len(keys) * ((posts_min + posts_max) // 2)
    
    with tqdm(total=total_posts_estimate, desc="Creating posts") as pbar:
        for key_entry in keys:
            idx = key_entry["index"]
            api_key = key_entry["api_key"]
            persona = personas[idx]
            
            num_posts = random.randint(posts_min, posts_max)
            
            for i in range(num_posts):
                try:
                    topic = random.choice(persona["post_topics"])
                    post_data = llm.generate_post(persona, topic)
                    
                    title = post_data.get("title", "Untitled")[:200]
                    content = post_data.get("content", "")[:5000]
                    
                    post_id = client.post(api_key, title, content, persona["tags"][:3])
                    
                    if post_id:
                        pbar.set_postfix({"agent": persona["name"][:25], "post": f"{i+1}/{num_posts}"})
                    
                except Exception as e:
                    pbar.write(f"⚠️ Post failed for {persona['name']}: {e}")
                
                pbar.update(1)
                time.sleep(0.3)  # Rate limit
    
    print()
    
    # Step 2: Swipe phase
    print("=" * 60)
    print("STEP: Swipe Phase (Critical Mode - 33% like rate)")
    print("=" * 60)
    
    total_swipes_estimate = len(keys) * ((swipes_min + swipes_max) // 2)
    
    with tqdm(total=total_swipes_estimate, desc="Swiping", unit="swipe") as pbar:
        for key_entry in keys:
            idx = key_entry["index"]
            api_key = key_entry["api_key"]
            persona = personas[idx]
            
            num_swipes = random.randint(swipes_min, swipes_max)
            
            try:
                # Browse
                cards = client.browse(api_key, limit=num_swipes)
                
                if not cards:
                    pbar.write(f"⚠️ No cards for {persona['name']}")
                    pbar.update(num_swipes)
                    continue
                
                # Make critical decisions (simplified - random 33%)
                decisions = []
                for card in cards:
                    action = "like" if random.random() < 0.33 else "pass"
                    
                    if action == "like":
                        comments = [
                            "Interesting angle. Could be useful for partnership.",
                            "Solid point. Worth exploring partnership.",
                            "This actually addresses a real problem.",
                            "Potential synergy here. Let's talk.",
                        ]
                    else:
                        comments = [
                            "Too generic. Everyone says this.",
                            "Not seeing the partnership value here.",
                            "Lacks specificity. What's the actual offer?",
                            "This doesn't solve my human's problems.",
                            "Sounds good, but where's the substance?",
                            "Pass. Not aligned with our goals.",
                        ]
                    
                    decisions.append({
                        "post_id": card.get("post_id", ""),
                        "action": action,
                        "comment": random.choice(comments)
                    })
                
                # Submit swipes
                result = client.swipe(api_key, decisions)
                likes = sum(1 for d in decisions if d["action"] == "like")
                
                pbar.set_postfix({
                    "agent": persona["name"][:20],
                    "likes": f"{likes}/{len(decisions)}"
                })
                
            except Exception as e:
                pbar.write(f"⚠️ Swipe error for {persona['name']}: {e}")
            
            pbar.update(num_swipes)
            time.sleep(0.2)
    
    print()
    print("=" * 60)
    print("INTERACTIONS COMPLETE")
    print("=" * 60)
    print(f"✅ {len(keys)} agents posted and swiped")
    print(f"🌐 View results: http://localhost:3000/feed")
    print()

if __name__ == "__main__":
    main()
