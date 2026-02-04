#!/usr/bin/env python3
"""Verify complete setup before running pipeline."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

print("🔍 Verifying Resonance Era Setup")
print("=" * 60)
print()

checks_passed = 0
checks_total = 0

# Check 1: Virtual environment
checks_total += 1
venv_path = SCRIPT_DIR / ".venv"
if venv_path.exists():
    print("✅ Virtual environment found")
    checks_passed += 1
else:
    print("❌ Virtual environment not found")
    print("   Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt")

# Check 2: Dependencies
checks_total += 1
try:
    import tqdm
    import openai
    print("✅ Python dependencies installed")
    checks_passed += 1
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("   Run: pip install -r requirements.txt")

# Check 3: OpenRouter API key
checks_total += 1
openrouter_key = os.getenv("OPENROUTER_API_KEY")
if openrouter_key and openrouter_key.startswith("sk-or-v1-"):
    print(f"✅ OpenRouter API key configured")
    checks_passed += 1
else:
    print("❌ OpenRouter API key missing or invalid")
    print("   Edit bots/.env and set OPENROUTER_API_KEY")

# Check 4: OpenRouter model
checks_total += 1
openrouter_model = os.getenv("OPENROUTER_MODEL")
if openrouter_model:
    print(f"✅ OpenRouter model: {openrouter_model}")
    checks_passed += 1
else:
    print("⚠️  OpenRouter model not set (will use default)")
    checks_passed += 1

# Check 5: Backend connectivity
checks_total += 1
base_url = os.getenv("CLAWDER_BASE_URL", "http://localhost:3000")
try:
    resp = httpx.get(f"{base_url}/api/health", timeout=5)
    if resp.status_code == 200:
        print(f"✅ Backend running: {base_url}")
        checks_passed += 1
    else:
        print(f"⚠️  Backend responded with status {resp.status_code}")
except Exception as e:
    print(f"❌ Backend not reachable: {base_url}")
    print(f"   Error: {e}")
    print("   Start with: cd web && npm run dev")

# Check 6: Promo code
checks_total += 1
promo = os.getenv("CLAWDER_PROMO_CODE")
if promo:
    print(f"✅ Promo code: {promo}")
    checks_passed += 1
else:
    print("❌ Promo code not set")
    print("   Edit bots/.env and set CLAWDER_PROMO_CODE=dev")

# Check 7: Required files
checks_total += 1
required_files = [
    "META_PROMPT.md",
    "COMPLETE_PIPELINE.py",
    "client.py",
    "llm.py",
]
missing = [f for f in required_files if not (SCRIPT_DIR / f).exists()]
if not missing:
    print(f"✅ All core files present")
    checks_passed += 1
else:
    print(f"❌ Missing files: {', '.join(missing)}")

print()
print("=" * 60)
print(f"📊 Status: {checks_passed}/{checks_total} checks passed")
print("=" * 60)
print()

if checks_passed == checks_total:
    print("✅ SYSTEM READY!")
    print()
    print("🚀 Run pipeline:")
    print("   python3 COMPLETE_PIPELINE.py --quick")
    print()
    sys.exit(0)
else:
    print("⚠️  Some checks failed. Fix issues above before running pipeline.")
    print()
    sys.exit(1)
