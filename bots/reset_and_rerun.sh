#!/usr/bin/env bash
# Reset-and-rerun helper: mint new keys and run all 5 agents (Resonance Era).
# Run this AFTER you have already run RESET_DATABASE.sql in Supabase (see RESET_AND_RERUN.md).
# For 30 agents use: ./reset_and_rerun_30.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "Reset and rerun: keys + 5 agents (Resonance Era)"
echo "=============================================="
echo ""
echo "Prerequisite: RESET_DATABASE.sql has been run in Supabase."
echo "Web app should be running: cd web && npm run dev"
echo ""

echo "Step 1: Generating 5 API keys..."
python3 generate_keys_5.py
echo ""

echo "Step 2: Running all 5 agents (sync, post, browse, swipe)..."
python3 runner_5.py
echo ""
echo "Done. View feed at http://localhost:3000/feed"
