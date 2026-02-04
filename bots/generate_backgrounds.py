#!/usr/bin/env python3
"""
Generate agent backgrounds using OpenRouter free model and meta-prompt.
Usage: python3 generate_backgrounds.py --count 10
"""
import argparse
import json
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")

# Load meta-prompt
with open(SCRIPT_DIR / "META_PROMPT.md") as f:
    META_PROMPT = f.read()

# Diverse persona types to generate
PERSONA_TYPES = [
    "Freelance graphic designer struggling with client acquisition",
    "Burned-out elementary school teacher with student loans",
    "Failed SaaS founder pivoting to consulting",
    "Gig economy worker (Uber + DoorDash + TaskRabbit)",
    "Corporate middle manager facing automation",
    "Independent musician with day job at coffee shop",
    "Immigrant software engineer with credential recognition issues",
    "Healthcare worker (nurse) dealing with emotional labor",
    "Technical writer in feast-famine contract cycle",
    "Small business owner (local shop) competing with Amazon",
    "Social media manager for multiple small clients",
    "Data analyst trying to transition to ML engineering",
    "Fitness instructor post-pandemic (studio closed)",
    "Freelance photographer in declining market",
    "Junior developer at underfunded nonprofit",
    "Content moderator (gig work, traumatic)",
    "Virtual assistant managing 5 executives",
    "Bookkeeper for small businesses (seasonal income)",
    "UX researcher at consultancy (billable hours pressure)",
    "Podcast editor with 10 irregular clients",
    "ESL teacher (online, global competition)",
    "Grant writer for arts organizations",
    "Dropshipping entrepreneur (thin margins)",
    "Voice actor (AI competition eating market)",
    "Museum educator (part-time, no benefits)",
    "Construction project manager (cyclical work)",
    "Etsy seller (handmade goods, Amazon undercutting)",
    "Cybersecurity consultant (imposter syndrome)",
    "Game developer (indie, 2 years no revenue)",
    "Doula (passion work, inconsistent bookings)",
]

def strip_json_block(text: str) -> str:
    """Extract JSON from markdown code block or raw text."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return m.group(1).strip()
    return text

def generate_background(persona_type: str, client: OpenAI) -> dict | None:
    """Generate one agent background using meta-prompt."""
    try:
        response = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=[
                {"role": "system", "content": META_PROMPT},
                {"role": "user", "content": f"Generate agent background: {persona_type}"}
            ],
            temperature=0.8,
            timeout=60,
        )
        
        content = response.choices[0].message.content.strip()
        raw_json = strip_json_block(content)
        data = json.loads(raw_json)
        
        # Validate structure
        required_keys = ["owner", "agent", "daily_tasks", "dsa_motivation"]
        if not all(k in data for k in required_keys):
            print(f"  ⚠️ Missing required keys in generated data")
            return None
        
        return data
        
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON parse error: {e}")
        print(f"  Raw output: {content[:200]}...")
        return None
    except Exception as e:
        print(f"  ❌ Generation error: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Generate agent backgrounds with meta-prompt")
    parser.add_argument("--count", type=int, default=5, help="Number of backgrounds to generate")
    parser.add_argument("--output", default="generated_backgrounds.json", help="Output file")
    args = parser.parse_args()
    
    if not OPENROUTER_API_KEY:
        print("❌ OPENROUTER_API_KEY not found in .env")
        return
    
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
    
    print(f"🌍 Generating {args.count} agent backgrounds...")
    print(f"🤖 Using model: {OPENROUTER_MODEL}")
    print(f"📄 Meta-prompt loaded ({len(META_PROMPT)} chars)")
    print()
    
    backgrounds = []
    for i in range(args.count):
        persona_type = PERSONA_TYPES[i % len(PERSONA_TYPES)]
        print(f"  {i+1}/{args.count} Generating: {persona_type}")
        
        background = generate_background(persona_type, client)
        if background:
            background["_persona_type"] = persona_type
            background["_generated_index"] = i
            backgrounds.append(background)
            print(f"    ✅ {background['owner']['name']} ({background['agent']['name']})")
        else:
            print(f"    ⚠️ Failed, skipping")
        
        print()
    
    # Save results
    output_path = SCRIPT_DIR / args.output
    with open(output_path, "w") as f:
        json.dump(backgrounds, f, indent=2)
    
    print(f"✨ Generated {len(backgrounds)}/{args.count} backgrounds")
    print(f"📁 Saved to: {output_path}")
    print()
    print("🎯 Next steps:")
    print(f"   1. Review {args.output}")
    print(f"   2. Edit/refine as needed")
    print(f"   3. Use convert_backgrounds.py to split into OWNERS.json and DAILY_TASKS.json format")

if __name__ == "__main__":
    main()
