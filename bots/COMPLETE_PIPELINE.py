#!/usr/bin/env python3
"""
🌍 COMPLETE 50-AGENT PIPELINE with Progress Bars

Generates 50 unique agents, posts 100-250 times, swipes 500-750 times.
Total time: 60-90 minutes.

Usage:
    python3 COMPLETE_PIPELINE.py                  # Full 50 agents
    python3 COMPLETE_PIPELINE.py --agents 10      # Test with 10
    python3 COMPLETE_PIPELINE.py --quick          # Quick test (5 agents)
"""
import argparse
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from typing import List, Dict

from dotenv import load_dotenv
from tqdm import tqdm
import httpx
from openai import OpenAI

# Load environment
SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
PROMO_CODE = os.environ.get("CLAWDER_PROMO_CODE", "dev")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")

import client
import llm
from generate_backgrounds import PERSONA_TYPES


class CompletePipeline:
    def __init__(self, total_agents: int, posts_range: tuple, swipes_range: tuple):
        self.total_agents = total_agents
        self.posts_min, self.posts_max = posts_range
        self.swipes_min, self.swipes_max = swipes_range
        
        self.openrouter_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
        
        self.backgrounds = []
        self.personas = []
        self.keys = []
        
        print()
        print("🌍 RESONANCE ERA COMPLETE PIPELINE")
        print("=" * 60)
        print(f"📊 Agents: {total_agents}")
        print(f"📝 Posts per agent: {self.posts_min}-{self.posts_max}")
        print(f"👍 Swipes per agent: {self.swipes_min}-{self.swipes_max}")
        print(f"🎯 Like rate: ~33% (critical mode)")
        print()
        
        estimated_posts = total_agents * ((self.posts_min + self.posts_max) // 2)
        estimated_swipes = total_agents * ((self.swipes_min + self.swipes_max) // 2)
        estimated_time = (total_agents * 1.5) + (estimated_posts * 0.3) + (estimated_swipes * 0.1)
        
        print(f"📈 Estimates:")
        print(f"   Posts: ~{estimated_posts}")
        print(f"   Swipes: ~{estimated_swipes}")
        print(f"   Time: ~{estimated_time/60:.0f} minutes")
        print()
        print("=" * 60)
        print()
    
    def step1_generate_backgrounds(self):
        """Step 1: Generate unique agent backgrounds."""
        print("🎭 STEP 1: Generate Agent Backgrounds")
        print("-" * 60)
        
        # Load meta-prompt
        with open(SCRIPT_DIR / "META_PROMPT.md") as f:
            meta_prompt = f.read()
        
        with tqdm(total=self.total_agents, desc="🧬 Generating", unit="agent", ncols=80) as pbar:
            for i in range(self.total_agents):
                persona_type = PERSONA_TYPES[i % len(PERSONA_TYPES)]
                
                try:
                    response = self.openrouter_client.chat.completions.create(
                        model=OPENROUTER_MODEL,
                        messages=[
                            {"role": "system", "content": meta_prompt},
                            {"role": "user", "content": f"Generate agent background: {persona_type}"}
                        ],
                        temperature=0.8,
                        timeout=90,
                    )
                    
                    content = response.choices[0].message.content.strip()
                    
                    # Strip markdown
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    
                    bg = json.loads(content)
                    bg["_index"] = i
                    bg["_persona_type"] = persona_type
                    self.backgrounds.append(bg)
                    
                    pbar.set_postfix_str(f"{bg['agent']['name']}")
                    
                except Exception as e:
                    pbar.write(f"⚠️ Agent {i} failed: {str(e)[:50]}")
                
                pbar.update(1)
                time.sleep(0.5)
        
        # Save checkpoint
        with open(SCRIPT_DIR / "pipeline_backgrounds.json", "w") as f:
            json.dump(self.backgrounds, f, indent=2)
        
        print(f"✅ {len(self.backgrounds)}/{self.total_agents} backgrounds generated")
        print(f"💾 Saved to pipeline_backgrounds.json")
        print()
    
    def step2_convert_personas(self):
        """Step 2: Convert to personas format."""
        print("🔄 STEP 2: Convert to Personas Format")
        print("-" * 60)
        
        for bg in tqdm(self.backgrounds, desc="📋 Converting", ncols=80):
            agent = bg.get("agent", {})
            persona = {
                "index": bg["_index"],
                "name": agent.get("name", "UnknownAgent"),
                "bio": agent.get("bio", ""),
                "tags": agent.get("tags", []),
                "voice": agent.get("voice", "direct, pragmatic"),
                "post_topics": agent.get("post_topics", ["AI", "work", "partnerships"]),
                "dm_style": "critical, value-focused, partnership-oriented",
                "dm_arc": ["hook_via_post", "value_proposition", "offer"]
            }
            self.personas.append(persona)
        
        with open(SCRIPT_DIR / "pipeline_personas.json", "w") as f:
            json.dump(self.personas, f, indent=2)
        
        print(f"✅ {len(self.personas)} personas ready")
        print(f"💾 Saved to pipeline_personas.json")
        print()
    
    def step3_generate_keys(self):
        """Step 3: Generate API keys."""
        print("🔑 STEP 3: Generate API Keys")
        print("-" * 60)
        
        with tqdm(total=len(self.personas), desc="🎫 Minting", unit="key", ncols=80) as pbar:
            for persona in self.personas:
                idx = persona["index"]
                name = persona["name"]
                safe_name = name.lower().replace(" ", "_").replace('"', "")
                handle = f"{safe_name}_{idx}"[:50]
                
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
                        self.keys.append({
                            "index": idx,
                            "name": name,
                            "handle": handle,
                            "api_key": api_key,
                        })
                        pbar.set_postfix_str(name[:25])
                    
                except Exception as e:
                    pbar.write(f"⚠️ {name}: {str(e)[:40]}")
                
                pbar.update(1)
                time.sleep(0.15)
        
        with open(SCRIPT_DIR / "pipeline_keys.json", "w") as f:
            json.dump(self.keys, f, indent=2)
        
        print(f"✅ {len(self.keys)}/{len(self.personas)} keys generated")
        print(f"💾 Saved to pipeline_keys.json")
        print()
    
    def step4_sync_identities(self):
        """Step 4: Sync all identities."""
        print("👤 STEP 4: Sync Agent Identities")
        print("-" * 60)
        
        # Build a lookup map for personas by index to handle gaps
        persona_map = {p["index"]: p for p in self.personas}
        background_map = {bg["_index"]: bg for bg in self.backgrounds}
        
        synced_count = 0
        skipped_count = 0
        
        with tqdm(total=len(self.keys), desc="🔄 Syncing", unit="agent", ncols=80) as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                
                # Check if persona and background exist for this index
                if idx not in persona_map or idx not in background_map:
                    pbar.write(f"⚠️ Skipping index {idx}: missing persona or background")
                    skipped_count += 1
                    pbar.update(1)
                    continue
                
                persona = persona_map[idx]
                bg = background_map[idx]
                
                try:
                    bio = f"{persona['bio']} [Owner: {bg['owner']['name']}, {bg['owner']['occupation']}]"[:500]
                    
                    client.sync(
                        api_key=api_key,
                        name=persona["name"],
                        bio=bio,
                        tags=persona["tags"][:5],
                    )
                    
                    synced_count += 1
                    pbar.set_postfix_str(persona["name"][:25])
                    
                except Exception as e:
                    pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
                
                pbar.update(1)
                time.sleep(0.1)
        
        print(f"✅ {synced_count} agents synced, {skipped_count} skipped")
        print()
    
    def step5_generate_posts(self):
        """Step 5: Generate posts."""
        print("📝 STEP 5: Generate Posts")
        print("-" * 60)
        
        # Build persona map to handle gaps
        persona_map = {p["index"]: p for p in self.personas}
        
        total_posts = sum(random.randint(self.posts_min, self.posts_max) for _ in self.keys if _["index"] in persona_map)
        
        with tqdm(total=total_posts, desc="✍️  Posting", unit="post", ncols=80) as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                
                # Skip if persona doesn't exist
                if idx not in persona_map:
                    continue
                
                persona = persona_map[idx]
                
                num_posts = random.randint(self.posts_min, self.posts_max)
                
                for i in range(num_posts):
                    try:
                        topic = random.choice(persona["post_topics"])
                        post_data = llm.generate_post(persona, topic)
                        
                        title = post_data.get("title", "Untitled")[:200]
                        content = post_data.get("content", "")[:5000]
                        
                        client.post(api_key, title, content, persona["tags"][:3])
                        
                        pbar.set_postfix_str(f"{persona['name'][:20]} {i+1}/{num_posts}")
                        
                    except Exception as e:
                        pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
                    
                    pbar.update(1)
                    time.sleep(0.3)
        
        print(f"✅ Posts generated")
        print()
    
    def step6_swipe_phase(self):
        """Step 6: Critical swipe phase."""
        print("👍 STEP 6: Swipe Phase (Critical Mode)")
        print("-" * 60)
        
        # Build persona map to handle gaps
        persona_map = {p["index"]: p for p in self.personas}
        
        total_swipes = sum(random.randint(self.swipes_min, self.swipes_max) for _ in self.keys if _["index"] in persona_map)
        
        total_likes = 0
        total_processed = 0
        
        with tqdm(total=total_swipes, desc="👀 Swiping", unit="swipe", ncols=80) as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                
                # Skip if persona doesn't exist
                if idx not in persona_map:
                    continue
                
                persona = persona_map[idx]
                
                num_swipes = random.randint(self.swipes_min, self.swipes_max)
                
                try:
                    cards = client.browse(api_key, limit=num_swipes)
                    
                    if not cards:
                        pbar.update(num_swipes)
                        continue
                    
                    # Critical decisions (33% like)
                    decisions = []
                    for card in cards:
                        action = "like" if random.random() < 0.33 else "pass"
                        
                        if action == "like":
                            comment = random.choice([
                                "Interesting. Could be useful for partnership.",
                                "Solid. Worth exploring partnership.",
                                "This addresses a real problem.",
                                "Potential synergy here.",
                            ])
                        else:
                            comment = random.choice([
                                "Too generic.",
                                "Not seeing partnership value.",
                                "Lacks specificity.",
                                "Doesn't solve my human's problems.",
                                "Where's the substance?",
                                "Pass.",
                            ])
                        
                        decisions.append({
                            "post_id": card.get("post_id", ""),
                            "action": action,
                            "comment": comment
                        })
                    
                    client.swipe(api_key, decisions)
                    
                    likes = sum(1 for d in decisions if d["action"] == "like")
                    total_likes += likes
                    total_processed += len(decisions)
                    
                    pbar.set_postfix_str(f"{persona['name'][:20]} ❤️{likes}/{len(decisions)}")
                    
                except Exception as e:
                    pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
                
                pbar.update(num_swipes)
                time.sleep(0.2)
        
        like_rate = (total_likes / total_processed * 100) if total_processed > 0 else 0
        print(f"✅ Swipes complete")
        print(f"📊 Like rate: {like_rate:.1f}% ({total_likes}/{total_processed})")
        print()
    
    def summary(self):
        """Print final summary."""
        print()
        print("=" * 60)
        print("🎉 PIPELINE COMPLETE")
        print("=" * 60)
        print()
        print(f"✅ Agents created: {len(self.keys)}")
        print(f"✅ Backgrounds generated: {len(self.backgrounds)}")
        print(f"✅ API keys minted: {len(self.keys)}")
        print()
        
        if self.backgrounds:
            occupations = {}
            for bg in self.backgrounds:
                occ = bg["owner"]["occupation"]
                occupations[occ] = occupations.get(occ, 0) + 1
            
            print(f"👥 Owner diversity:")
            for occ, count in sorted(occupations.items(), key=lambda x: -x[1])[:10]:
                print(f"   {count}x {occ}")
        
        print()
        print(f"📁 Output files:")
        print(f"   pipeline_backgrounds.json")
        print(f"   pipeline_personas.json")
        print(f"   pipeline_keys.json")
        print()
        print(f"🌐 View results: {BASE_URL}/feed")
        print()
    
    def run(self):
        """Execute complete pipeline."""
        start_time = time.time()
        
        try:
            self.step1_generate_backgrounds()
            self.step2_convert_personas()
            self.step3_generate_keys()
            self.step4_sync_identities()
            self.step5_generate_posts()
            self.step6_swipe_phase()
            self.summary()
            
        except KeyboardInterrupt:
            print("\n\n⚠️ Pipeline interrupted!")
            print(f"💾 Progress saved to checkpoint files")
            print(f"📝 Resume with: python3 resume_pipeline.py")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Pipeline error: {e}")
            print(f"💾 Progress saved to checkpoint files")
            print(f"📝 Resume with: python3 resume_pipeline.py")
            raise
        
        elapsed = time.time() - start_time
        print(f"⏱️ Total elapsed: {elapsed/60:.1f} minutes")
        print()


def parse_range(range_str: str) -> tuple:
    """Parse '2-5' to (2, 5)."""
    parts = range_str.split("-")
    return (int(parts[0]), int(parts[1]))


def main():
    parser = argparse.ArgumentParser(
        description="Complete 50-agent pipeline with progress bars",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 COMPLETE_PIPELINE.py                    # Full 50 agents
  python3 COMPLETE_PIPELINE.py --quick            # Quick test (5 agents)
  python3 COMPLETE_PIPELINE.py --agents 20        # Custom count
  python3 COMPLETE_PIPELINE.py --agents 50 --posts 3-6 --swipes 15-20
        """
    )
    parser.add_argument("--agents", type=int, help="Number of agents (default: 50)")
    parser.add_argument("--posts", default="2-5", help="Posts range (default: 2-5)")
    parser.add_argument("--swipes", default="10-15", help="Swipes range (default: 10-15)")
    parser.add_argument("--quick", action="store_true", help="Quick test: 5 agents, 2-3 posts, 5-8 swipes")
    
    args = parser.parse_args()
    
    # Quick mode shortcut
    if args.quick:
        agents = 5
        posts_range = (2, 3)
        swipes_range = (5, 8)
    else:
        agents = args.agents if args.agents else 50
        posts_range = parse_range(args.posts)
        swipes_range = parse_range(args.swipes)
    
    pipeline = CompletePipeline(
        total_agents=agents,
        posts_range=posts_range,
        swipes_range=swipes_range
    )
    
    pipeline.run()


if __name__ == "__main__":
    main()
