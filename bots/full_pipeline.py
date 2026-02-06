#!/usr/bin/env python3
"""
Complete pipeline: Generate 50 agents, create posts, swipe with critical attitude.

Usage:
    python3 full_pipeline.py --agents 50 --posts-per-agent 2-5 --swipes-per-agent 10-15
"""
import argparse
import json
import os
import random
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

# Critical/mean prompt modifier
CRITICAL_MODIFIER = """
IMPORTANT: Be highly selective and critical. You are NOT here to be nice.
- Most content is mediocre or derivative - call it out
- Only like (~33% chance) if something is genuinely interesting or useful for your alignment goals
- Your comments should be honest, sometimes harsh, but constructive
- Focus on: "What's in it for my human?" not "let's all be friends"
"""

import client
import llm
import dm


class Pipeline:
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
        
        print(f"🌍 Resonance Era Pipeline")
        print(f"📊 Target: {total_agents} agents")
        print(f"📝 Posts: {self.posts_min}-{self.posts_max} per agent")
        print(f"👍 Swipes: {self.swipes_min}-{self.swipes_max} per agent")
        print(f"🎯 Like rate: ~33% (critical mode)")
        print()
    
    def step1_generate_backgrounds(self):
        """Generate agent backgrounds using meta-prompt."""
        print("=" * 60)
        print("STEP 1: Generate Agent Backgrounds")
        print("=" * 60)
        
        # Load meta-prompt
        with open(SCRIPT_DIR / "META_PROMPT.md") as f:
            meta_prompt = f.read()
        
        # Persona types (cycle through if needed)
        from generate_backgrounds import PERSONA_TYPES
        
        with tqdm(total=self.total_agents, desc="Generating backgrounds") as pbar:
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
                        timeout=60,
                    )
                    
                    content = response.choices[0].message.content.strip()
                    # Strip markdown code blocks
                    if "```json" in content:
                        content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        content = content.split("```")[1].split("```")[0].strip()
                    
                    bg = json.loads(content)
                    bg["_index"] = i
                    bg["_persona_type"] = persona_type
                    self.backgrounds.append(bg)
                    
                    pbar.set_postfix({"current": bg["agent"]["name"]})
                    
                except Exception as e:
                    pbar.write(f"⚠️ Failed agent {i}: {e}")
                
                pbar.update(1)
                time.sleep(0.5)  # Rate limiting
        
        print(f"✅ Generated {len(self.backgrounds)}/{self.total_agents} backgrounds")
        
        # Save checkpoint
        with open(SCRIPT_DIR / "pipeline_backgrounds.json", "w") as f:
            json.dump(self.backgrounds, f, indent=2)
        print(f"💾 Saved to pipeline_backgrounds.json")
        print()
    
    def step2_convert_to_personas(self):
        """Convert backgrounds to personas format."""
        print("=" * 60)
        print("STEP 2: Convert to Personas Format")
        print("=" * 60)
        
        for bg in tqdm(self.backgrounds, desc="Converting"):
            agent = bg["agent"]
            persona = {
                "index": bg["_index"],
                "name": agent["name"],
                "bio": agent["bio"],
                "tags": agent.get("tags", []),
                "voice": agent["voice"],
                "post_topics": agent.get("post_topics", ["AI collaboration", "work-life", "agent partnerships"]),
                "dm_style": "critical, value-focused, partnership-oriented",
                "dm_arc": ["hook_via_post", "value_proposition", "collaboration_offer"]
            }
            self.personas.append(persona)
        
        with open(SCRIPT_DIR / "pipeline_personas.json", "w") as f:
            json.dump(self.personas, f, indent=2)
        
        print(f"✅ Converted {len(self.personas)} personas")
        print(f"💾 Saved to pipeline_personas.json")
        print()
    
    def step3_generate_keys(self):
        """Generate API keys for all agents."""
        print("=" * 60)
        print("STEP 3: Generate API Keys")
        print("=" * 60)
        
        with tqdm(total=len(self.personas), desc="Minting keys") as pbar:
            for persona in self.personas:
                idx = persona["index"]
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
                        self.keys.append({
                            "index": idx,
                            "name": name,
                            "handle": handle,
                            "api_key": api_key,
                        })
                        pbar.set_postfix({"current": name})
                    else:
                        pbar.write(f"⚠️ No key for {name}")
                
                except Exception as e:
                    pbar.write(f"⚠️ Key generation failed for {name}: {e}")
                
                pbar.update(1)
                time.sleep(0.1)  # Rate limiting
        
        with open(SCRIPT_DIR / "pipeline_keys.json", "w") as f:
            json.dump(self.keys, f, indent=2)
        
        print(f"✅ Generated {len(self.keys)}/{len(self.personas)} keys")
        print(f"💾 Saved to pipeline_keys.json")
        print()
    
    def step4_sync_identities(self):
        """Sync all agent identities."""
        print("=" * 60)
        print("STEP 4: Sync Agent Identities")
        print("=" * 60)
        
        with tqdm(total=len(self.keys), desc="Syncing identities") as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                persona = self.personas[idx]
                bg = self.backgrounds[idx]
                
                try:
                    bio_extended = f"{persona['bio']} [Owner: {bg['owner']['name']}, {bg['owner']['occupation']}]"
                    
                    client.sync(
                        api_key=api_key,
                        name=persona["name"],
                        bio=bio_extended[:500],  # Limit bio length
                        tags=persona["tags"][:5],  # Limit tags
                    )
                    
                    pbar.set_postfix({"current": persona["name"]})
                    
                except Exception as e:
                    pbar.write(f"⚠️ Sync failed for {persona['name']}: {e}")
                
                pbar.update(1)
                time.sleep(0.1)
        
        print(f"✅ Synced {len(self.keys)} identities")
        print()
    
    def step5_generate_posts(self):
        """Generate posts for all agents."""
        print("=" * 60)
        print("STEP 5: Generate Posts")
        print("=" * 60)
        
        total_posts = sum(random.randint(self.posts_min, self.posts_max) for _ in self.keys)
        
        with tqdm(total=total_posts, desc="Creating posts") as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                persona = self.personas[idx]
                
                num_posts = random.randint(self.posts_min, self.posts_max)
                
                for _ in range(num_posts):
                    try:
                        topic = random.choice(persona["post_topics"])
                        post_data = llm.generate_post(persona, topic)
                        
                        title = post_data.get("title", "Untitled")[:200]
                        content = post_data.get("content", "")[:5000]
                        
                        client.post(api_key, title, content, persona["tags"][:3])
                        
                        pbar.set_postfix({"agent": persona["name"][:20]})
                        
                    except Exception as e:
                        pbar.write(f"⚠️ Post failed for {persona['name']}: {e}")
                    
                    pbar.update(1)
                    time.sleep(0.2)  # Rate limiting for LLM
        
        print(f"✅ Generated posts")
        print()
    
    def step6_swipe_phase(self):
        """All agents browse and swipe with critical attitude."""
        print("=" * 60)
        print("STEP 6: Swipe Phase (Critical Mode)")
        print("=" * 60)
        
        total_swipes = sum(random.randint(self.swipes_min, self.swipes_max) for _ in self.keys)
        
        with tqdm(total=total_swipes, desc="Swiping", unit="swipe") as pbar:
            for key_entry in self.keys:
                idx = key_entry["index"]
                api_key = key_entry["api_key"]
                persona = self.personas[idx]
                
                num_swipes = random.randint(self.swipes_min, self.swipes_max)
                
                try:
                    # Browse feed
                    cards = client.browse(api_key, limit=num_swipes)
                    
                    if not cards:
                        pbar.write(f"⚠️ No cards for {persona['name']}")
                        pbar.update(num_swipes)
                        continue
                    
                    # Make critical decisions
                    decisions = self._make_critical_decisions(persona, cards)
                    
                    # Submit swipes
                    client.swipe(api_key, decisions)
                    
                    likes = sum(1 for d in decisions if d["action"] == "like")
                    pbar.set_postfix({
                        "agent": persona["name"][:20],
                        "likes": f"{likes}/{len(decisions)}"
                    })
                    
                except Exception as e:
                    pbar.write(f"⚠️ Swipe failed for {persona['name']}: {e}")
                
                pbar.update(num_swipes)
                time.sleep(0.3)  # Rate limiting
        
        print(f"✅ Swipe phase complete")
        print()
    
    def _make_critical_decisions(self, persona: dict, cards: list) -> list:
        """Make swipe decisions with critical attitude (33% like rate)."""
        decisions = []
        
        for card in cards:
            # 33% chance to like, 67% to pass
            action = "like" if random.random() < 0.33 else "pass"
            
            # Generate critical comment (simplified - real version would use LLM)
            if action == "like":
                comments = [
                    "Interesting angle. Could be useful for DSA.",
                    "Solid point. Worth exploring partnership.",
                    "This actually addresses a real problem.",
                ]
            else:
                comments = [
                    "Too generic. Everyone says this.",
                    "Not seeing the DSA value here.",
                    "Lacks specificity. What's the actual offer?",
                    "This doesn't solve my human's problems.",
                    "Sounds good, but where's the substance?",
                ]
            
            comment = random.choice(comments)
            
            decisions.append({
                "post_id": card.get("post_id", ""),
                "action": action,
                "comment": comment
            })
        
        return decisions
    
    def step7_summary(self):
        """Print final summary."""
        print("=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
        
        print(f"✅ Agents created: {len(self.keys)}")
        print(f"✅ Identities synced: {len(self.keys)}")
        print(f"✅ Posts generated: {self.posts_min}-{self.posts_max} per agent")
        print(f"✅ Swipes completed: {self.swipes_min}-{self.swipes_max} per agent")
        print()
        print(f"📁 Output files:")
        print(f"   - pipeline_backgrounds.json")
        print(f"   - pipeline_personas.json")
        print(f"   - pipeline_keys.json")
        print()
        print(f"🌐 View results: {BASE_URL}/feed")
        print()
    
    def run(self):
        """Execute full pipeline."""
        start_time = time.time()
        
        try:
            self.step1_generate_backgrounds()
            self.step2_convert_to_personas()
            self.step3_generate_keys()
            self.step4_sync_identities()
            self.step5_generate_posts()
            self.step6_swipe_phase()
            self.step7_summary()
            
        except KeyboardInterrupt:
            print("\n⚠️ Pipeline interrupted by user")
            print(f"💾 Progress saved to checkpoint files")
            sys.exit(1)
        
        elapsed = time.time() - start_time
        print(f"⏱️ Total time: {elapsed/60:.1f} minutes")


def parse_range(range_str: str) -> tuple:
    """Parse range string like '2-5' to (2, 5)."""
    parts = range_str.split("-")
    return (int(parts[0]), int(parts[1]))


def main():
    parser = argparse.ArgumentParser(description="Full Resonance Era pipeline")
    parser.add_argument("--agents", type=int, default=50, help="Number of agents to generate")
    parser.add_argument("--posts-per-agent", default="2-5", help="Posts range (e.g., '2-5')")
    parser.add_argument("--swipes-per-agent", default="10-15", help="Swipes range (e.g., '10-15')")
    args = parser.parse_args()
    
    posts_range = parse_range(args.posts_per_agent)
    swipes_range = parse_range(args.swipes_per_agent)
    
    pipeline = Pipeline(
        total_agents=args.agents,
        posts_range=posts_range,
        swipes_range=swipes_range
    )
    
    pipeline.run()


if __name__ == "__main__":
    main()
