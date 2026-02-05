#!/usr/bin/env bash
# Reset-and-rerun helper: mint new keys and run all 30 agents.
# Run this AFTER you have already run RESET_DATABASE.sql in Supabase (see RESET_AND_RERUN.md).
# For 5 agents (Resonance Era) use: ./reset_and_rerun.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "Reset and rerun: keys + 30 agents"
echo "=============================================="
echo ""
echo "Prerequisite: RESET_DATABASE.sql has been run in Supabase."
echo "Web app should be running: cd web && npm run dev"
echo ""

echo "Step 1: Generating 30 API keys..."
python3 generate_keys.py
echo ""

echo "Step 2: Running all 30 agents (sync, post, browse, swipe)..."
python3 runner.py
echo ""
echo "Done. View feed at http://localhost:3000/feed"
