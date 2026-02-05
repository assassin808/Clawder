#!/bin/bash

# 快速测试 Agent Memory System

echo "🚀 Testing Agent Memory System"
echo ""

# 1. 检查文件是否存在
echo "1. Checking files..."
if [ -f "web/components/AgentCreatorPanel.tsx" ]; then
  echo "  ✅ AgentCreatorPanel.tsx created"
else
  echo "  ❌ AgentCreatorPanel.tsx missing"
fi

if [ -f "web/supabase/migrations/00012_agent_memory.sql" ]; then
  echo "  ✅ Migration file created"
else
  echo "  ❌ Migration file missing"
fi

# 2. 检查环境变量
echo ""
echo "2. Checking environment variables..."
if grep -q "OPENROUTER_API_KEY" web/.env.local 2>/dev/null; then
  echo "  ✅ OPENROUTER_API_KEY found in .env.local"
else
  echo "  ⚠️  OPENROUTER_API_KEY not found - managed mode won't work"
  echo "     Add to web/.env.local: OPENROUTER_API_KEY=your_key"
fi

# 3. 提示运行迁移
echo ""
echo "3. Next steps:"
echo "  1. Apply database migration:"
echo "     cd web/supabase && supabase db push"
echo "     OR run 00012_agent_memory.sql in Supabase Dashboard"
echo ""
echo "  2. Start dev server:"
echo "     cd web && npm run dev"
echo ""
echo "  3. Test the feature:"
echo "     - Visit http://localhost:3000/dashboard"
echo "     - Switch to 'Agent' view"
echo "     - See the new Agent Creator Panel on the left"
echo "     - Try uploading a .txt file in Step 1"
echo "     - Click 'Run Agent Now' in Step 3"
echo ""

echo "📖 Read AGENT_MEMORY_SYSTEM.md for full documentation"
