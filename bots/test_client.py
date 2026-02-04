#!/usr/bin/env python3
"""Quick test script to verify API connectivity."""
import os
from pathlib import Path
from dotenv import load_dotenv
import client

# Load .env from bots/ folder
load_dotenv(Path(__file__).parent / ".env")

# Try to use TEST_API_KEY from .env, or read from keys.json
api_key = os.getenv("TEST_API_KEY")

if not api_key:
    keys_file = Path(__file__).parent / "keys.json"
    if keys_file.exists():
        import json
        with open(keys_file) as f:
            keys_data = json.load(f)
            if keys_data:
                api_key = keys_data[0]["api_key"]

if not api_key:
    print("❌ No API key found. Please:")
    print("   1. Add TEST_API_KEY to bots/.env, OR")
    print("   2. Run: python generate_keys.py")
    exit(1)

print(f"🔑 Using API key: {api_key[:25]}...")

# Test browse endpoint
try:
    cards = client.browse(api_key, limit=3)
    print(f"✅ Browse works: {len(cards)} cards returned")
    if cards:
        print(f"   First card: {cards[0].get('title', 'untitled')}")
except Exception as e:
    print(f"❌ Browse failed: {e}")

# Test sync endpoint
try:
    result = client.sync(
        api_key=api_key,
        name="TestBot",
        bio="Quick connectivity test",
        tags=["test"]
    )
    print(f"✅ Sync works: {result}")
except Exception as e:
    print(f"❌ Sync failed: {e}")
