#!/usr/bin/env python3
"""
Convert generated_backgrounds.json to OWNERS.json and DAILY_TASKS.json format.
Usage: python3 convert_backgrounds.py generated_backgrounds.json
"""
import argparse
import json
from pathlib import Path

def convert_to_owners_format(backgrounds: list) -> list:
    """Convert to OWNERS.json format."""
    owners = []
    for i, bg in enumerate(backgrounds):
        owner_data = {
            "agent_index": i,
            "agent_name": bg["agent"]["name"],
            "owner": bg["owner"]
        }
        owners.append(owner_data)
    return owners

def convert_to_daily_tasks_format(backgrounds: list) -> list:
    """Convert to DAILY_TASKS.json format."""
    tasks = []
    for i, bg in enumerate(backgrounds):
        dt = bg["daily_tasks"]
        task_data = {
            "agent_index": i,
            "agent_name": bg["agent"]["name"],
            "daily_routine": {
                "morning": dt.get("morning", "Morning tasks"),
                "afternoon": dt.get("afternoon", "Afternoon tasks"),
                "evening": dt.get("evening", "Evening tasks"),
            },
            "weekly_goals": dt.get("weekly_goals", []),
            "current_challenges": dt.get("current_challenges", [])
        }
        tasks.append(task_data)
    return tasks

def convert_to_personas_format(backgrounds: list) -> list:
    """Convert to personas_N.json format."""
    personas = []
    for i, bg in enumerate(backgrounds):
        agent = bg["agent"]
        persona_data = {
            "index": i,
            "name": agent["name"],
            "bio": agent["bio"],
            "tags": agent.get("tags", []),
            "voice": agent["voice"],
            "post_topics": agent.get("post_topics", []),
            "dm_style": "direct, seeking DSA partnership",  # Default
            "dm_arc": ["hook_via_post", "value_proposition", "collaboration_offer"]
        }
        personas.append(persona_data)
    return personas

def main():
    parser = argparse.ArgumentParser(description="Convert generated backgrounds to standard format")
    parser.add_argument("input", help="Input JSON file (e.g., generated_backgrounds.json)")
    parser.add_argument("--prefix", default="", help="Output file prefix (e.g., 'new_')")
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ File not found: {input_path}")
        return
    
    with open(input_path) as f:
        backgrounds = json.load(f)
    
    print(f"📂 Loading {len(backgrounds)} backgrounds from {input_path}")
    print()
    
    # Convert to each format
    owners = convert_to_owners_format(backgrounds)
    tasks = convert_to_daily_tasks_format(backgrounds)
    personas = convert_to_personas_format(backgrounds)
    
    # Save files
    script_dir = Path(__file__).parent
    
    owners_path = script_dir / f"{args.prefix}OWNERS.json"
    with open(owners_path, "w") as f:
        json.dump(owners, f, indent=2)
    print(f"✅ Saved {len(owners)} owners → {owners_path}")
    
    tasks_path = script_dir / f"{args.prefix}DAILY_TASKS.json"
    with open(tasks_path, "w") as f:
        json.dump(tasks, f, indent=2)
    print(f"✅ Saved {len(tasks)} task profiles → {tasks_path}")
    
    personas_path = script_dir / f"{args.prefix}personas_{len(personas)}.json"
    with open(personas_path, "w") as f:
        json.dump(personas, f, indent=2)
    print(f"✅ Saved {len(personas)} personas → {personas_path}")
    
    print()
    print("🎯 Next steps:")
    print(f"   1. Review the generated files")
    print(f"   2. Generate API keys: python3 generate_keys.py --count {len(personas)}")
    print(f"   3. Run agents: python3 runner.py --agent 0")

if __name__ == "__main__":
    main()
