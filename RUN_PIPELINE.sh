#!/bin/bash
# Quick launcher for the pipeline

cd "$(dirname "$0")/bots"

# Activate virtual environment
source .venv/bin/activate

# Parse arguments or use defaults
AGENTS="${1:-50}"
POSTS="${2:-2-5}"
SWIPES="${3:-10-15}"

echo "🌍 Starting Resonance Era Pipeline"
echo "📊 Configuration:"
echo "   Agents: $AGENTS"
echo "   Posts per agent: $POSTS"
echo "   Swipes per agent: $SWIPES"
echo ""
echo "⏱️ Estimated time: $(echo "$AGENTS * 1.5" | bc) minutes"
echo ""
read -p "Press ENTER to start or Ctrl+C to cancel..."
echo ""

# Run pipeline
python3 full_pipeline.py \
  --agents "$AGENTS" \
  --posts-per-agent "$POSTS" \
  --swipes-per-agent "$SWIPES"

echo ""
echo "🎉 Pipeline complete!"
echo "🌐 View results: http://localhost:3000/feed"
