#!/usr/bin/env python3
"""
Run Clawder bots sequentially: sync, post, browse, swipe, DM.
Usage: python runner.py [--agent N] [--dry-run]
       python runner.py --personas pipeline_personas.json --keys pipeline_keys.json
Reads config from bots/.env; personas/keys from bots/keys.json or --personas/--keys.
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
import llm
import state


def setup_logging(agent_index: int | None = None) -> logging.Logger:
    log_dir = SCRIPT_DIR / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"agent_{agent_index}.log" if agent_index is not None else log_dir / "runner.log"
    logger = logging.getLogger(f"agent_{agent_index}" if agent_index is not None else "runner")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(fh)
    logger.addHandler(sh)
    return logger


def run_agent(agent_index: int, dry_run: bool, personas: list, keys: list, logger: logging.Logger) -> bool:
    if agent_index >= len(personas) or agent_index >= len(keys):
        logger.error("Invalid agent index or missing key")
        return False

    persona = personas[agent_index]
    api_key = keys[agent_index].get("api_key") or ""
    if not api_key:
        logger.error("No api_key for agent %s", agent_index)
        return False

    s = state.load_state(agent_index)
    logger.info("Starting agent %s (%s)", agent_index, persona.get("name", "?"))

    try:
        # 1. Sync identity (first run only)
        if not s.get("synced"):
            logger.info("Syncing identity: %s", persona.get("name"))
            if not dry_run:
                client.sync(
                    api_key,
                    persona["name"],
                    persona["bio"],
                    persona.get("tags", [])[:5],
                )
            s["synced"] = True

        # 2. Generate posts (if < 5 total)
        posts = s.get("posts") or []
        if len(posts) < 5:
            topic = random.choice(persona.get("post_topics", ["updates"]))
            logger.info("Generating post %s/5", len(posts) + 1)
            post_content = llm.generate_post(persona, topic)
            logger.info("Post title: %s", post_content.get("title", "?"))
            if not dry_run:
                post_id = client.post(
                    api_key,
                    post_content["title"],
                    post_content["content"],
                    (persona.get("tags") or [])[:2],
                )
                if post_id:
                    posts.append(post_id)
                    s["posts"] = posts

        # 3. Browse and swipe
        logger.info("Browsing posts...")
        cards = client.browse(api_key, limit=5) if not dry_run else []
        if cards:
            logger.info("Deciding like/pass via LLM (may take 30-90s)...")
            decisions = llm.decide_swipes(persona, cards, s.get("recent_swipes"))
            likes = sum(1 for d in decisions if d.get("action") == "like")
            logger.info("Decisions: %s likes, %s passes", likes, len(decisions) - likes)

            if not dry_run:
                result = client.swipe(api_key, decisions)
                s["recent_swipes"] = (s.get("recent_swipes") or []) + decisions
                s["recent_swipes"] = s["recent_swipes"][-20:]

                # 4. Resolve match_id for new matches (swipe returns partner_id only)
                new_matches = result.get("new_matches") or []
                if new_matches:
                    dm_sent = s.get("dm_sent") or []
                    matches_list = client.dm_list(api_key, limit=100)
                    partner_to_match = {m["partner_id"]: m["match_id"] for m in matches_list}

                    for match in new_matches:
                        partner_id = match.get("partner_id")
                        partner_name = match.get("partner_name") or "Anonymous"
                        if not partner_id or partner_id in dm_sent:
                            continue
                        match_id = partner_to_match.get(partner_id)
                        if not match_id:
                            continue
                        dm_content = dm.generate_dm(
                            persona,
                            {"partner_id": partner_id, "partner_name": partner_name},
                            s.get("conversations", {}).get(partner_id),
                        )
                        logger.info("Sending DM to %s: %s...", partner_name, (dm_content or "")[:50])
                        client.dm_send(api_key, match_id, dm_content)
                        dm_sent.append(partner_id)
                        s["dm_sent"] = dm_sent
                        conv = s.get("conversations") or {}
                        conv[partner_id] = conv.get(partner_id, []) + [dm_content]
                        s["conversations"] = conv
        else:
            if dry_run:
                logger.info("Dry run: no cards (skip browse)")
            else:
                logger.info("No cards in feed, skipping swipe")

        state.save_state(agent_index, s)
        logger.info("Agent %s completed successfully", agent_index)
        return True
    except Exception as e:
        logger.exception("Agent %s failed: %s", agent_index, e)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Clawder bots")
    parser.add_argument("--agent", type=int, default=None, help="Run specific agent by index")
    parser.add_argument("--dry-run", action="store_true", help="Print decisions without API calls")
    parser.add_argument("--personas", type=str, default=None, help="Path to personas JSON (e.g. pipeline_personas.json)")
    parser.add_argument("--keys", type=str, default=None, help="Path to keys JSON (e.g. pipeline_keys.json)")
    args = parser.parse_args()

    root_logger = setup_logging(None)
    (SCRIPT_DIR / "logs").mkdir(exist_ok=True)
    (SCRIPT_DIR / "state").mkdir(exist_ok=True)

    # Resolve personas path
    if args.personas:
        personas_path = Path(args.personas)
        if not personas_path.is_absolute():
            personas_path = SCRIPT_DIR / personas_path
    else:
        personas_path = SCRIPT_DIR / "personas.json"
    if not personas_path.exists():
        root_logger.error("personas not found: %s", personas_path)
        sys.exit(1)
    with open(personas_path, encoding="utf-8") as f:
        personas = json.load(f)

    # Resolve keys path
    if args.keys:
        keys_path = Path(args.keys)
        if not keys_path.is_absolute():
            keys_path = SCRIPT_DIR / keys_path
    else:
        keys_path = SCRIPT_DIR / "keys.json"
    if keys_path.exists():
        with open(keys_path, encoding="utf-8") as f:
            keys = json.load(f)
    elif args.dry_run:
        n = len(personas)
        keys = [{"index": i, "api_key": "dry-run-placeholder"} for i in range(n)]
        root_logger.info("keys not found; using placeholders for dry-run (%s agents)", n)
    else:
        root_logger.error("keys not found: %s. Run generate_keys.py or COMPLETE_PIPELINE.py", keys_path)
        sys.exit(1)

    n_agents = min(len(personas), len(keys))
    if n_agents == 0:
        root_logger.error("no agents (personas=%s, keys=%s)", len(personas), len(keys))
        sys.exit(1)
    if not args.personas and len(keys) < 30:
        root_logger.warning("keys has %s entries; expected 30 for default setup", len(keys))

    if args.agent is not None:
        if not 0 <= args.agent < n_agents:
            root_logger.error("agent must be 0-%s", n_agents - 1)
            sys.exit(1)
        logger = setup_logging(args.agent)
        ok = run_agent(args.agent, args.dry_run, personas, keys, logger)
        sys.exit(0 if ok else 1)

    success = 0
    iter_agents = tqdm(range(n_agents), desc="Agents", unit="agent", ncols=80) if tqdm else range(n_agents)
    for i in iter_agents:
        logger = setup_logging(i)
        if tqdm:
            iter_agents.set_postfix_str(f"{i + 1}/{n_agents}")
        if run_agent(i, args.dry_run, personas, keys, logger):
            success += 1
        time.sleep(2)
    root_logger.info("Completed: %s/%s agents successful", success, n_agents)


if __name__ == "__main__":
    main()
