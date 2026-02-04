#!/usr/bin/env python3
"""
Runner for the 5 Resonance Era agents.
Uses personas_5.json, OWNERS.json, DAILY_TASKS.json, and system_prompt.py
"""
import argparse
import json
import logging
import random
import sys
from pathlib import Path

import client
import dm
import llm
import state as state_manager
from system_prompt import get_full_system_prompt

SCRIPT_DIR = Path(__file__).resolve().parent
LOGS_DIR = SCRIPT_DIR / "logs"
STATE_DIR = SCRIPT_DIR / "state"

LOGS_DIR.mkdir(exist_ok=True)
STATE_DIR.mkdir(exist_ok=True)

# Load resources
with open(SCRIPT_DIR / "personas_5.json") as f:
    PERSONAS = json.load(f)

with open(SCRIPT_DIR / "OWNERS.json") as f:
    OWNERS = json.load(f)

with open(SCRIPT_DIR / "keys_5.json") as f:
    KEYS = json.load(f)

def setup_logger(agent_index: int) -> logging.Logger:
    """Setup logger for specific agent."""
    logger = logging.getLogger(f"agent_{agent_index}")
    logger.setLevel(logging.INFO)
    
    # File handler
    fh = logging.FileHandler(LOGS_DIR / f"agent_{agent_index}_resonance.log")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    
    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    
    logger.addHandler(fh)
    logger.addHandler(ch)
    
    return logger

def run_agent(agent_index: int, dry_run: bool = False):
    """Run one agent through full cycle with Resonance Era context."""
    persona = PERSONAS[agent_index]
    owner = OWNERS[agent_index]
    key_entry = KEYS[agent_index]
    api_key = key_entry["api_key"]
    
    logger = setup_logger(agent_index)
    logger.info(f"🌍 Starting Resonance Era Agent {agent_index} ({persona['name']})")
    logger.info(f"👤 Owner: {owner['owner']['name']} - {owner['owner']['occupation']}")
    
    # Load state
    agent_state = state_manager.load_state(agent_index)
    # Ensure required fields exist
    if "posts_created" not in agent_state:
        agent_state["posts_created"] = 0
    if "swipes_made" not in agent_state:
        agent_state["swipes_made"] = 0
    if "matches" not in agent_state:
        agent_state["matches"] = 0
    
    # 1. Sync identity with full worldview context
    if not dry_run:
        try:
            sync_resp = client.sync(
                api_key=api_key,
                name=persona["name"],
                bio=f"{persona['bio']} [Owner: {owner['owner']['name']}, {owner['owner']['occupation']}]",
                tags=persona["tags"],
            )
            logger.info(f"✅ Synced identity: {sync_resp}")
        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            return
    
    # 2. Generate posts (reflecting owner's situation)
    logger.info(f"📝 Generating posts...")
    for i in range(5):
        topic = random.choice(persona.get("post_topics", ["AI collaboration"]))
        logger.info(f"Post {i+1}/5 - Topic: {topic}")
        
        if dry_run:
            logger.info(f"  [DRY-RUN] Would generate post on: {topic}")
            continue
        
        try:
            post_data = llm.generate_post(persona, topic)
            title = post_data.get("title", "Untitled")
            content = post_data.get("content", "")
            
            logger.info(f"  Title: {title}")
            logger.info(f"  Content: {content[:100]}...")
            
            post_id = client.post(api_key, title, content, persona["tags"])
            if post_id:
                logger.info(f"  ✅ Posted: {post_id}")
                agent_state["posts_created"] += 1
            else:
                logger.warning(f"  ⚠️ Post failed")
        except Exception as e:
            logger.error(f"  ❌ Post generation error: {e}")
    
    # 3. Browse & Swipe (evaluating DSA potential)
    logger.info(f"👀 Browsing feed for DSA partners...")
    if dry_run:
        logger.info(f"  [DRY-RUN] Would browse and swipe")
    else:
        try:
            cards = client.browse(api_key, limit=5)
            logger.info(f"  Found {len(cards)} cards")
            
            if cards:
                decisions = llm.decide_swipes(persona, cards)
                logger.info(f"  Made {len(decisions)} swipe decisions")
                
                swipe_resp = client.swipe(api_key, decisions)
                processed = swipe_resp.get("processed", 0)
                new_matches = swipe_resp.get("new_matches", [])
                
                logger.info(f"  ✅ Processed: {processed}, New matches: {len(new_matches)}")
                agent_state["swipes_made"] += processed
                agent_state["matches"] += len(new_matches)
        except Exception as e:
            logger.error(f"  ❌ Browse/Swipe error: {e}")
    
    # 4. Send DMs (DSA partnership proposals)
    if not dry_run:
        logger.info(f"💬 Checking for matches to DM...")
        # TODO: Implement match fetching and DM sending with DSA context
    
    # 5. Save state
    from datetime import datetime
    agent_state["last_run"] = datetime.now().isoformat()
    state_manager.save_state(agent_index, agent_state)
    
    logger.info(f"✅ Agent {agent_index} ({persona['name']}) completed")
    logger.info(f"📊 Stats: {agent_state['posts_created']} posts, {agent_state['swipes_made']} swipes, {agent_state['matches']} matches")

def main():
    parser = argparse.ArgumentParser(description="Run Resonance Era agents")
    parser.add_argument("--agent", type=int, help="Run specific agent (0-4)")
    parser.add_argument("--dry-run", action="store_true", help="Don't make API calls")
    args = parser.parse_args()
    
    if args.agent is not None:
        if args.agent < 0 or args.agent > 4:
            print(f"❌ Agent index must be 0-4")
            sys.exit(1)
        run_agent(args.agent, dry_run=args.dry_run)
    else:
        # Run all 5 agents sequentially
        for i in range(5):
            run_agent(i, dry_run=args.dry_run)
            print()

if __name__ == "__main__":
    main()
