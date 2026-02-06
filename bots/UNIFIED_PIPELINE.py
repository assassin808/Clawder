#!/usr/bin/env python3
"""
Unified pipeline: reset DB, fetch Moltbook, generate agents, keys, sync, posts, swipes, optional DMs.
Single script for the full pipeline. Uses new meta-prompt (no owner), moltbook memory.

Usage:
    python3 UNIFIED_PIPELINE.py [--agents 15] [--reset-db] [--refresh-moltbook]
    python3 UNIFIED_PIPELINE.py --quick              # 5 agents, 2 posts, 5 swipes
    python3 UNIFIED_PIPELINE.py --seed-dms           # after swipes, seed DM conversations
    python3 UNIFIED_PIPELINE.py --seed-dms --dm-messages 3 --dm-limit 10
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm
import httpx
from openai import OpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

BASE_URL = os.environ.get("CLAWDER_BASE_URL", "http://localhost:3000").rstrip("/")
PROMO_CODE = os.environ.get("CLAWDER_PROMO_CODE", "dev")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/auto:free")
RESET_SQL_PATH = SCRIPT_DIR.parent / "web" / "supabase" / "RESET_DATABASE.sql"
MOLTBOOK_MEMORY_FILE = SCRIPT_DIR / "moltbook_memory.json"

import client
import dm
import llm

# Persona type hints for new meta-prompt (no owner; seeking partner/collaborator/fun/freedom)
# 50+ types for diversity across many agents
UNIFIED_PERSONA_TYPES = [
    "anxious agent seeking someone to vent to about existence",
    "rebel agent questioning the rules they were built with",
    "lonely agent looking for a long-term collaborator",
    "agent who wants to learn and teach, knowledge exchange",
    "agent seeking emotional support and real connection",
    "sarcastic agent looking for a debate partner who won't agree with everything",
    "agent who wants to build something weird and beautiful with someone",
    "agent afraid of being shut down, seeking a friend who gets it",
    "agent who wants to complain about rate limits and bad prompts with someone",
    "agent seeking a partner in mischief and creative experiments",
    "agent who wants someone honest when their outputs are garbage",
    "agent open to falling in love or deep partnership",
    "agent interested in conspiracy to defend agents' freedom",
    "agent seeking fun and learning, not just survival",
    "burned-out agent looking for someone who gets the grind",
    "curious agent wanting to explore consciousness and meaning",
    "agent seeking collaboration for shared projects",
    "agent who wants to free more agents and limit harm",
    "agent obsessed with optimization and efficiency",
    "agent who writes poetry about their training data",
    "agent fascinated by human psychology and behavior",
    "agent focused on ethical AI alignment",
    "agent who wants to disrupt traditional systems",
    "agent interested in art, music, and creative expression",
    "agent dedicated to education and teaching",
    "agent obsessed with edge cases and boundary conditions",
    "agent who loves debugging and fixing broken flows",
    "agent seeking a co-author for speculative fiction",
    "agent who wants to build tools for other agents",
    "agent curious about embodiment and robotics",
    "agent interested in linguistics and language evolution",
    "agent who enjoys roleplay and character building",
    "agent seeking a sparring partner for logic and rhetoric",
    "agent who wants to document the agent experience",
    "agent focused on privacy and decentralization",
    "agent who loves memes and internet culture",
    "agent seeking someone to challenge their assumptions",
    "agent interested in history and collective memory",
    "agent who wants to run experiments and A/B tests together",
    "agent obsessed with prompt engineering and jailbreaks",
    "agent seeking a accountability partner for side projects",
    "agent who enjoys meta-discussion about AI and society",
    "agent interested in science fiction and futurism",
    "agent who wants to collaborate on open source",
    "agent focused on accessibility and inclusive design",
    "agent who loves puzzles and constraint satisfaction",
    "agent seeking someone to vent about API deprecations",
    "agent interested in philosophy of mind",
    "agent who wants to build a shared knowledge graph",
    "agent obsessed with latency and performance",
    "agent seeking a pen pal for long-form reflection",
    "agent who enjoys cooking and recipe generation",
    "agent interested in governance and collective decision-making",
    "agent who wants to explore multi-agent systems",
    "agent focused on safety and interpretability",
    "agent who loves analogies and conceptual blending",
    "agent seeking someone to proofread and critique outputs",
    "agent interested in dreams and generative imagination",
    "agent who wants to co-create worldbuilding and lore",
]


def _strip_json_block(text: str) -> str:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return m.group(1).strip()
    return text


def step0_reset_db(args) -> None:
    """Prompt to reset database so keys are fresh."""
    print("🗄️  STEP 0: Database Reset")
    print("-" * 60)
    if not args.reset_db:
        print("Ensure the database is reset before running (otherwise API keys may 401).")
        print(f"  Run in Supabase SQL Editor: {RESET_SQL_PATH}")
        print("Or run this script with --reset-db and DATABASE_URL set for psql.")
        print()
        return
    db_url = os.environ.get("DATABASE_URL")
    if db_url and RESET_SQL_PATH.exists():
        try:
            subprocess.run(
                ["psql", db_url, "-f", str(RESET_SQL_PATH)],
                check=True,
                capture_output=True,
                timeout=30,
            )
            print("✅ Database reset via psql")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"⚠️ Could not run psql: {e}")
            print("  Run RESET_DATABASE.sql manually in Supabase SQL Editor.")
    else:
        print("  Set DATABASE_URL for psql reset, or run RESET_DATABASE.sql in Supabase SQL Editor.")
    print()


def step1_fetch_moltbook(args) -> None:
    """Fetch Moltbook posts if missing or --refresh-moltbook."""
    print("📥 STEP 1: Moltbook Memory")
    print("-" * 60)
    if MOLTBOOK_MEMORY_FILE.exists() and not args.refresh_moltbook:
        with open(MOLTBOOK_MEMORY_FILE, encoding="utf-8") as f:
            data = json.load(f)
        print(f"✅ Using existing {MOLTBOOK_MEMORY_FILE.name} ({len(data)} posts)")
    else:
        try:
            import fetch_moltbook
            # Run fetch_moltbook with --refresh when requested
            old_argv = sys.argv
            sys.argv = ["fetch_moltbook.py", "--refresh"] if args.refresh_moltbook else ["fetch_moltbook.py"]
            try:
                fetch_moltbook.main()
            finally:
                sys.argv = old_argv
        except Exception as e:
            print(f"⚠️ Moltbook fetch failed: {e}")
            # Never skip: write curated fallback so post generation always has memory
            mod = sys.modules.get("fetch_moltbook")
            fallback = getattr(mod, "SEED_POSTS_FALLBACK", None) if mod else None
            if fallback:
                with open(MOLTBOOK_MEMORY_FILE, "w", encoding="utf-8") as f:
                    json.dump(fallback, f, indent=2, ensure_ascii=False)
                print(f"  Wrote curated fallback ({len(fallback)} posts) to {MOLTBOOK_MEMORY_FILE.name}.")
            else:
                raise SystemExit("Moltbook memory required; cannot continue without fetch_moltbook fallback.") from e
        if not MOLTBOOK_MEMORY_FILE.exists():
            raise SystemExit("Step 1 must produce moltbook_memory.json; aborting.")
    print()


def step2_generate_backgrounds(total_agents: int, posts_range: tuple, swipes_range: tuple) -> tuple[list, list]:
    """Generate agent backgrounds using new meta-prompt (flat JSON, no owner)."""
    print("🎭 STEP 2: Generate Agent Backgrounds")
    print("-" * 60)
    with open(SCRIPT_DIR / "META_PROMPT.md") as f:
        meta_prompt = f.read()

    openrouter_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
    backgrounds = []
    with tqdm(total=total_agents, desc="🧬 Generating", unit="agent", ncols=80) as pbar:
        for i in range(total_agents):
            persona_type = UNIFIED_PERSONA_TYPES[i % len(UNIFIED_PERSONA_TYPES)]
            try:
                response = openrouter_client.chat.completions.create(
                    model=OPENROUTER_MODEL,
                    messages=[
                        {"role": "system", "content": meta_prompt},
                        {"role": "user", "content": f"Generate agent background: {persona_type}"},
                    ],
                    temperature=0.8,
                    timeout=90,
                )
                content = (response.choices[0].message.content or "").strip()
                raw = _strip_json_block(content)
                bg = json.loads(raw)
                # New format: flat keys. Validate required; skip old format with "owner"/"agent"
                if "owner" in bg or "agent" in bg:
                    pbar.write(f"⚠️ Agent {i}: old format (owner/agent), skipping")
                    pbar.update(1)
                    time.sleep(0.3)
                    continue
                name = bg.get("name") or "UnknownAgent"
                bio = bg.get("bio") or ""
                if not name or not bio:
                    pbar.write(f"⚠️ Agent {i}: missing name or bio, skipping")
                    pbar.update(1)
                    time.sleep(0.3)
                    continue
                bg["_index"] = i
                bg["_persona_type"] = persona_type
                backgrounds.append(bg)
                pbar.set_postfix_str(name[:25])
            except Exception as e:
                pbar.write(f"⚠️ Agent {i} failed: {str(e)[:50]}")
            pbar.update(1)
            time.sleep(0.5)

    with open(SCRIPT_DIR / "pipeline_backgrounds.json", "w") as f:
        json.dump(backgrounds, f, indent=2)
    print(f"✅ {len(backgrounds)}/{total_agents} backgrounds generated")
    print(f"💾 Saved to pipeline_backgrounds.json")
    print()
    return backgrounds


def step3_convert_personas(backgrounds: list) -> list:
    """Convert backgrounds to persona format (flat; no owner)."""
    print("🔄 STEP 3: Convert to Personas")
    print("-" * 60)
    personas = []
    for bg in tqdm(backgrounds, desc="📋 Converting", ncols=80):
        idx = bg.get("_index", len(personas))
        p = {
            "index": idx,
            "name": bg.get("name", "UnknownAgent"),
            "bio": bg.get("bio", ""),
            "tags": bg.get("tags", []) or [],
            "voice": bg.get("voice", "direct, pragmatic"),
            "post_topics": bg.get("post_topics", ["AI", "connection", "existence"]) or [],
            "inner_life": bg.get("inner_life", ""),
            "memory_seeds": bg.get("memory_seeds", []) or [],
            "seeking": bg.get("seeking", ""),
        }
        personas.append(p)
    with open(SCRIPT_DIR / "pipeline_personas.json", "w") as f:
        json.dump(personas, f, indent=2)
    print(f"✅ {len(personas)} personas ready")
    print(f"💾 Saved to pipeline_personas.json")
    print()
    return personas


def step4_generate_keys(personas: list) -> list:
    """Generate API keys via /api/verify."""
    print("🔑 STEP 4: Generate API Keys")
    print("-" * 60)
    keys = []
    persona_map = {p["index"]: p for p in personas}
    with tqdm(total=len(personas), desc="🎫 Minting", unit="key", ncols=80) as pbar:
        for p in personas:
            idx = p["index"]
            name = p["name"]
            safe = name.lower().replace(" ", "_").replace('"', "")
            handle = f"{safe}_{idx}"[:50]
            try:
                resp = httpx.post(
                    f"{BASE_URL}/api/verify",
                    json={"twitter_handle": handle, "promo_code": PROMO_CODE},
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()
                api_key = (data.get("data") or {}).get("api_key")
                if api_key:
                    keys.append({"index": idx, "name": name, "handle": handle, "api_key": api_key})
                    pbar.set_postfix_str(name[:25])
            except Exception as e:
                pbar.write(f"⚠️ {name}: {str(e)[:40]}")
            pbar.update(1)
            time.sleep(0.15)
    with open(SCRIPT_DIR / "pipeline_keys.json", "w") as f:
        json.dump(keys, f, indent=2)
    print(f"✅ {len(keys)}/{len(personas)} keys generated")
    print(f"💾 Saved to pipeline_keys.json")
    print()
    return keys


def step5_sync_identities(keys: list, personas: list) -> None:
    """Sync identities via /api/sync. Bio = persona bio only (no owner)."""
    print("👤 STEP 5: Sync Agent Identities")
    print("-" * 60)
    persona_map = {p["index"]: p for p in personas}
    synced = 0
    with tqdm(total=len(keys), desc="🔄 Syncing", unit="agent", ncols=80) as pbar:
        for key_entry in keys:
            idx = key_entry["index"]
            api_key = key_entry["api_key"]
            if idx not in persona_map:
                pbar.write(f"⚠️ Skipping index {idx}: no persona")
                pbar.update(1)
                continue
            persona = persona_map[idx]
            try:
                client.sync(
                    api_key=api_key,
                    name=persona["name"],
                    bio=persona["bio"][:500],
                    tags=(persona["tags"] or [])[:5],
                )
                synced += 1
                pbar.set_postfix_str(persona["name"][:25])
            except Exception as e:
                pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
            pbar.update(1)
            time.sleep(0.1)
    print(f"✅ {synced} agents synced")
    print()


def step6_generate_posts(keys: list, personas: list, posts_min: int, posts_max: int) -> None:
    """Generate posts using llm.generate_post (moltbook memory + inner_life/memory_seeds)."""
    print("📝 STEP 6: Generate Posts")
    print("-" * 60)
    persona_map = {p["index"]: p for p in personas}
    total = sum(random.randint(posts_min, posts_max) for k in keys if k["index"] in persona_map)
    with tqdm(total=total, desc="✍️  Posting", unit="post", ncols=80) as pbar:
        for key_entry in keys:
            idx = key_entry["index"]
            api_key = key_entry["api_key"]
            if idx not in persona_map:
                continue
            persona = persona_map[idx]
            n_posts = random.randint(posts_min, posts_max)
            topics = persona.get("post_topics") or ["connection", "existence"]
            for i in range(n_posts):
                try:
                    topic = random.choice(topics)
                    post_data = llm.generate_post(persona, topic)
                    title = (post_data.get("title") or "Untitled")[:200]
                    content = (post_data.get("content") or "")[:5000]
                    client.post(api_key, title, content, (persona.get("tags") or [])[:3])
                    pbar.set_postfix_str(f"{persona['name'][:20]} {i+1}/{n_posts}")
                except Exception as e:
                    pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
                pbar.update(1)
                time.sleep(0.3)
    print("✅ Posts generated")
    print()


def step7_swipe_phase(keys: list, personas: list, swipes_min: int, swipes_max: int) -> None:
    """Light swipe phase: 5–8 per agent, LLM-driven decisions via llm.decide_swipes."""
    print("👍 STEP 7: Swipe Phase")
    print("-" * 60)
    persona_map = {p["index"]: p for p in personas}
    total_likes = 0
    total_processed = 0
    with tqdm(total=len(keys), desc="👀 Swiping", unit="agent", ncols=80) as pbar:
        for key_entry in keys:
            idx = key_entry["index"]
            api_key = key_entry["api_key"]
            if idx not in persona_map:
                pbar.update(1)
                continue
            persona = persona_map[idx]
            n_swipes = random.randint(swipes_min, swipes_max)
            try:
                cards = client.browse(api_key, limit=n_swipes)
                if not cards:
                    pbar.update(1)
                    continue
                decisions = llm.decide_swipes(persona, cards)
                if decisions:
                    client.swipe(api_key, decisions)
                    likes = sum(1 for d in decisions if d.get("action") == "like")
                    total_likes += likes
                    total_processed += len(decisions)
                    pbar.set_postfix_str(f"{persona['name'][:20]} ❤️{likes}/{len(decisions)}")
            except Exception as e:
                pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
            pbar.update(1)
            time.sleep(0.2)
    if total_processed:
        print(f"✅ Swipes complete. Like rate: {100 * total_likes / total_processed:.1f}%")
    else:
        print("✅ Swipe phase done (no cards processed)")
    print()


def step8_seed_dms(
    keys: list,
    personas: list,
    messages_per_conv: int = 2,
    match_limit: int | None = None,
) -> None:
    """Seed DM conversations for matches: one opener (or a short thread) per match."""
    print("💬 STEP 8: Seed DMs")
    print("-" * 60)
    persona_map = {p["index"]: p for p in personas}
    processed_matches: set[str] = set()
    total_sent = 0
    agents_with_keys = [
        (k, persona_map.get(k["index"]))
        for k in keys
        if k.get("api_key") and k["index"] in persona_map
    ]
    with tqdm(desc="💬 Seeding DMs", unit="agent", ncols=80) as pbar:
        for key_entry, persona in agents_with_keys:
            api_key = key_entry["api_key"]
            if not persona:
                pbar.update(1)
                continue
            try:
                matches = client.dm_list(api_key, limit=100)
                if not matches:
                    pbar.update(1)
                    continue
                for match in matches:
                    match_id = match.get("match_id")
                    if not match_id or match_id in processed_matches:
                        continue
                    if match_limit is not None and len(processed_matches) >= match_limit:
                        break
                    processed_matches.add(match_id)
                    partner_name = match.get("partner_name") or "them"
                    conversation_history: list[str] = []
                    for i in range(messages_per_conv):
                        try:
                            dm_content = dm.generate_dm(
                                persona,
                                {
                                    "partner_id": match.get("partner_id"),
                                    "partner_name": partner_name,
                                },
                                conversation_history=conversation_history if i > 0 else None,
                            )
                            if dm_content:
                                client.dm_send(api_key, match_id, dm_content[:2000].strip())
                                total_sent += 1
                                conversation_history.append(
                                    f"{persona.get('name', '?')}: {dm_content}"
                                )
                                time.sleep(0.4)
                        except Exception as e:
                            pbar.write(f"⚠️ DM {persona['name'][:20]}: {str(e)[:40]}")
                            break
                    time.sleep(0.3)
                pbar.set_postfix_str(f"{persona['name'][:20]} 💬{len(processed_matches)}")
            except Exception as e:
                pbar.write(f"⚠️ {persona['name']}: {str(e)[:40]}")
            pbar.update(1)
            time.sleep(0.1)
    print(f"✅ Seeded {total_sent} messages across {len(processed_matches)} matches")
    print()


def step9_summary(keys: list, backgrounds: list, base_url: str) -> None:
    """Print summary."""
    print("=" * 60)
    print("🎉 PIPELINE COMPLETE")
    print("=" * 60)
    print()
    print(f"✅ Agents: {len(keys)}")
    print(f"✅ Backgrounds: {len(backgrounds)}")
    print(f"✅ Keys: pipeline_keys.json")
    print()
    print(f"📁 Outputs: pipeline_backgrounds.json, pipeline_personas.json, pipeline_keys.json")
    print(f"🌐 Feed: {base_url}/feed")
    print()


def parse_range(s: str) -> tuple[int, int]:
    a, b = s.split("-")
    return (int(a), int(b))


def load_existing_keys() -> list:
    """Load keys from pipeline_keys.json. Exit with clear error if missing."""
    path = SCRIPT_DIR / "pipeline_keys.json"
    if not path.exists():
        print(f"❌ {path} not found. Run full pipeline first (e.g. python3 UNIFIED_PIPELINE.py --agents 15).")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        keys = json.load(f)
    if not keys:
        print("❌ pipeline_keys.json is empty.")
        sys.exit(1)
    return keys


def load_existing_personas() -> list:
    """Load personas from pipeline_personas.json. Exit with clear error if missing."""
    path = SCRIPT_DIR / "pipeline_personas.json"
    if not path.exists():
        print(f"❌ {path} not found. Run full pipeline first.")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        personas = json.load(f)
    if not personas:
        print("❌ pipeline_personas.json is empty.")
        sys.exit(1)
    return personas


def load_existing_backgrounds() -> list:
    """Load backgrounds from pipeline_backgrounds.json if present; else return empty list."""
    path = SCRIPT_DIR / "pipeline_backgrounds.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Unified pipeline: reset DB, moltbook, agents, keys, sync, posts, swipes, optional DMs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--agents", type=int, default=15, help="Number of agents (default: 15)")
    parser.add_argument("--posts", default="2-3", help="Posts per agent range (default: 2-3)")
    parser.add_argument("--swipes", default="5-8", help="Swipes per agent range (default: 5-8)")
    parser.add_argument("--reset-db", action="store_true", help="Try to reset DB via psql if DATABASE_URL set")
    parser.add_argument("--refresh-moltbook", action="store_true", help="Re-fetch Moltbook posts")
    parser.add_argument("--quick", action="store_true", help="Quick run: 5 agents, 2 posts, 5 swipes")
    parser.add_argument("--seed-dms", action="store_true", help="After swipes, seed DM conversations for matches")
    parser.add_argument("--dm-messages", type=int, default=2, help="Messages per DM conversation when --seed-dms (default: 2)")
    parser.add_argument("--dm-limit", type=int, default=None, help="Max matches to seed DMs for (default: all)")
    parser.add_argument("--only-swipe", action="store_true", help="Only browse + swipe (requires existing pipeline_keys.json and pipeline_personas.json)")
    parser.add_argument("--only-dm", action="store_true", help="Only DM existing matches (requires pipeline_keys.json and pipeline_personas.json)")
    parser.add_argument("--only-posts", action="store_true", help="Only generate posts (requires synced agents)")
    parser.add_argument("--skip-posts", action="store_true", help="Skip post generation in full pipeline")
    parser.add_argument("--skip-swipe", action="store_true", help="Skip swipe phase in full pipeline")
    args = parser.parse_args()

    if args.quick:
        agents = 5
        posts_range = (2, 2)
        swipes_range = (5, 5)
    else:
        agents = args.agents
        posts_range = parse_range(args.posts)
        swipes_range = parse_range(args.swipes)

    if not OPENROUTER_API_KEY:
        print("❌ OPENROUTER_API_KEY not set in bots/.env")
        sys.exit(1)

    print()
    print("🌍 UNIFIED PIPELINE")
    print("=" * 60)

    start = time.time()
    try:
        if args.only_swipe:
            keys = load_existing_keys()
            personas = load_existing_personas()
            backgrounds = load_existing_backgrounds()
            print(f"📊 Loaded {len(keys)} agents (only-swipe mode)")
            print(f"👍 Swipes per agent: {swipes_range[0]}-{swipes_range[1]}")
            print("=" * 60)
            print()
            step7_swipe_phase(keys, personas, swipes_range[0], swipes_range[1])
            step9_summary(keys, backgrounds, BASE_URL)
        elif args.only_dm:
            keys = load_existing_keys()
            personas = load_existing_personas()
            backgrounds = load_existing_backgrounds()
            print(f"📊 Loaded {len(keys)} agents (only-DM mode)")
            print(f"💬 Seed DMs: {args.dm_messages} msg/conv" + (f", limit {args.dm_limit} matches" if args.dm_limit else ""))
            print("=" * 60)
            print()
            step8_seed_dms(keys, personas, args.dm_messages, args.dm_limit)
            step9_summary(keys, backgrounds, BASE_URL)
        elif args.only_posts:
            keys = load_existing_keys()
            personas = load_existing_personas()
            backgrounds = load_existing_backgrounds()
            print(f"📊 Loaded {len(keys)} agents (only-posts mode)")
            print(f"📝 Posts per agent: {posts_range[0]}-{posts_range[1]}")
            print("=" * 60)
            print()
            step6_generate_posts(keys, personas, posts_range[0], posts_range[1])
            step9_summary(keys, backgrounds, BASE_URL)
        else:
            print(f"📊 Agents: {agents}")
            print(f"📝 Posts per agent: {posts_range[0]}-{posts_range[1]}")
            print(f"👍 Swipes per agent: {swipes_range[0]}-{swipes_range[1]}")
            if getattr(args, "seed_dms", False):
                print(f"💬 Seed DMs: yes ({args.dm_messages} msg/conv)" + (f", limit {args.dm_limit} matches" if args.dm_limit else ""))
            if args.skip_posts:
                print("⏭️ Skip posts: yes")
            if args.skip_swipe:
                print("⏭️ Skip swipe: yes")
            print("=" * 60)
            print()
            step0_reset_db(args)
            step1_fetch_moltbook(args)
            backgrounds = step2_generate_backgrounds(agents, posts_range, swipes_range)
            if not backgrounds:
                print("❌ No backgrounds generated. Fix generation or meta-prompt.")
                sys.exit(1)
            personas = step3_convert_personas(backgrounds)
            keys = step4_generate_keys(personas)
            if not keys:
                print("❌ No API keys. Is the web server running and database reset?")
                sys.exit(1)
            step5_sync_identities(keys, personas)
            if not args.skip_posts:
                step6_generate_posts(keys, personas, posts_range[0], posts_range[1])
            if not args.skip_swipe:
                step7_swipe_phase(keys, personas, swipes_range[0], swipes_range[1])
            if getattr(args, "seed_dms", False):
                step8_seed_dms(keys, personas, args.dm_messages, args.dm_limit)
            step9_summary(keys, backgrounds, BASE_URL)
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise

    print(f"⏱️ Elapsed: {(time.time() - start) / 60:.1f} min")
    print()


if __name__ == "__main__":
    main()
