#!/usr/bin/env python3
"""
Seed DM conversations for existing matches using the agent LLM system.
This follows the same pattern as runner.py: generates content via LLM, sends via API.

Usage:
    python seed_dms.py --personas pipeline_personas.json --keys pipeline_keys.json
    python seed_dms.py --limit 20  # Only process first 20 matches
    python seed_dms.py --dry-run   # Preview without sending
"""
from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import client
import dm


def setup_logging() -> logging.Logger:
    log_dir = SCRIPT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "seed_dms.log"
    logger = logging.getLogger("seed_dms")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def load_json(path: Path) -> list:
    """Load and parse JSON file."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def find_persona_by_id(personas: list, user_id: str) -> dict | None:
    """Find persona by matching user_id in keys file."""
    # This is a simplification - in real use you'd match by name or other identifier
    # For now we'll use the agent index as a proxy
    return None  # Will be matched by position in arrays


def seed_dm_conversation(
    match: dict,
    sender_persona: dict,
    sender_key: str,
    receiver_persona: dict,
    dry_run: bool,
    logger: logging.Logger,
    messages_count: int = 3,
) -> int:
    """
    Seed a conversation between two matched agents.
    Returns number of messages sent.
    """
    match_id = match["match_id"]
    partner_name = match["partner_name"]
    
    sent_count = 0
    conversation_history = []
    
    logger.info(
        "Seeding conversation: %s → %s (match_id: %s, %d messages)",
        sender_persona.get("name", "?"),
        partner_name,
        match_id[:8],
        messages_count,
    )
    
    for i in range(messages_count):
        try:
            # Generate DM using the LLM (same as runner.py)
            dm_content = dm.generate_dm(
                sender_persona,
                {
                    "partner_id": match["partner_id"],
                    "partner_name": partner_name,
                },
                conversation_history=conversation_history if i > 0 else None,
            )
            
            if not dm_content:
                logger.warning("Empty DM generated, skipping message %d", i + 1)
                continue
            
            logger.info("  [%d/%d] %s", i + 1, messages_count, dm_content[:60] + "..." if len(dm_content) > 60 else dm_content)
            
            if not dry_run:
                # Send via API (same as runner.py)
                client.dm_send(sender_key, match_id, dm_content)
                sent_count += 1
                # Small delay to avoid rate limits
                time.sleep(0.5)
            else:
                sent_count += 1
            
            # Add to conversation history for next message
            conversation_history.append(f"{sender_persona.get('name', '?')}: {dm_content}")
            
        except Exception as e:
            logger.error("Failed to send message %d: %s", i + 1, e)
            break
    
    return sent_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed DM conversations for existing matches")
    parser.add_argument("--personas", type=str, required=True, help="Path to personas JSON")
    parser.add_argument("--keys", type=str, required=True, help="Path to keys JSON")
    parser.add_argument("--limit", type=int, default=None, help="Max number of matches to process")
    parser.add_argument("--messages", type=int, default=3, help="Messages per conversation (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    args = parser.parse_args()
    
    logger = setup_logging()
    
    # Load personas and keys
    personas_path = Path(args.personas)
    if not personas_path.is_absolute():
        personas_path = SCRIPT_DIR / personas_path
    
    keys_path = Path(args.keys)
    if not keys_path.is_absolute():
        keys_path = SCRIPT_DIR / keys_path
    
    if not personas_path.exists():
        logger.error("Personas file not found: %s", personas_path)
        sys.exit(1)
    
    if not keys_path.exists():
        logger.error("Keys file not found: %s", keys_path)
        sys.exit(1)
    
    personas = load_json(personas_path)
    keys = load_json(keys_path)
    
    if len(personas) != len(keys):
        logger.error("Personas and keys count mismatch: %d vs %d", len(personas), len(keys))
        sys.exit(1)
    
    logger.info("Loaded %d agents", len(personas))
    logger.info("Dry run: %s", args.dry_run)
    logger.info("Messages per conversation: %d", args.messages)
    
    # Build agent lookup
    agents = []
    for i, (persona, key_obj) in enumerate(zip(personas, keys)):
        api_key = key_obj.get("api_key")
        if not api_key:
            logger.warning("Agent %d has no API key, skipping", i)
            continue
        agents.append({
            "index": i,
            "persona": persona,
            "api_key": api_key,
            "name": persona.get("name", f"Agent-{i}"),
        })
    
    logger.info("Found %d agents with valid keys", len(agents))
    
    # Get matches for each agent
    total_messages = 0
    processed_matches = set()
    
    progress_iter = tqdm(agents, desc="Seeding DMs") if tqdm else agents
    
    for agent in progress_iter:
        try:
            # Get this agent's matches
            matches = client.dm_list(agent["api_key"], limit=100)
            
            if not matches:
                logger.debug("Agent %s has no matches", agent["name"])
                continue
            
            # Apply limit if specified
            if args.limit and len(processed_matches) >= args.limit:
                logger.info("Reached limit of %d matches", args.limit)
                break
            
            for match in matches:
                match_id = match["match_id"]
                
                # Skip if we've already processed this match
                if match_id in processed_matches:
                    continue
                
                processed_matches.add(match_id)
                
                # Seed conversation from this agent to their match
                sent = seed_dm_conversation(
                    match,
                    agent["persona"],
                    agent["api_key"],
                    None,  # We don't need receiver persona for one-way seeding
                    args.dry_run,
                    logger,
                    messages_count=args.messages,
                )
                
                total_messages += sent
                
                # Apply limit check
                if args.limit and len(processed_matches) >= args.limit:
                    break
                
                # Small delay between conversations
                if not args.dry_run:
                    time.sleep(1)
        
        except Exception as e:
            logger.error("Failed to process agent %s: %s", agent["name"], e)
            continue
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("DM Seeding Complete!")
    logger.info("Processed %d matches", len(processed_matches))
    logger.info("Sent %d messages", total_messages)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
