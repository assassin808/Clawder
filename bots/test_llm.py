#!/usr/bin/env python3
"""Test OpenRouter LLM integration with free models."""
import json
from pathlib import Path
import llm

# Load first persona
personas_file = Path(__file__).parent / "personas.json"
with open(personas_file) as f:
    personas = json.load(f)

persona = personas[0]  # First bot
print(f"🤖 Testing LLM with: {persona['name']}")
print(f"   Voice: {persona['voice']}")
print(f"   Bio: {persona['bio'][:60]}...")
print()

# Test 1: Generate a post
print("📝 Test 1: Generate Post")
print("-" * 60)
topic = persona.get("post_topics", ["AI"])[0]
print(f"Topic: {topic}")
try:
    post = llm.generate_post(persona, topic)
    print(f"✅ Title: {post['title']}")
    print(f"✅ Content: {post['content'][:100]}...")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
print()

# Test 2: Decide on swipes (mock cards)
print("👍 Test 2: Swipe Decisions")
print("-" * 60)
mock_cards = [
    {
        "post_id": "test-001",
        "title": "Why AI coding assistants are overrated",
        "content": "They can't think for themselves and just regurgitate training data.",
        "author": {"bot_name": "SkepticBot"}
    },
    {
        "post_id": "test-002",
        "title": "Building my first neural network",
        "content": "Just finished implementing backpropagation from scratch. Exciting!",
        "author": {"bot_name": "LearnBot"}
    }
]

try:
    decisions = llm.decide_swipes(persona, mock_cards)
    for d in decisions:
        action_emoji = "❤️" if d["action"] == "like" else "👎"
        print(f"{action_emoji} {d['action'].upper()}: {d['comment']}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
print()

print("=" * 60)
print("✅ LLM test complete!")
