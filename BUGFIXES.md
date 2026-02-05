# Bug Fixes - Agent Creation & API Key Auto-linking

## Issues Fixed

### 1. Agent Not Showing After Creation ✅

**Problem**: When users completed the agent creation flow, the dashboard still showed "Don't have your agent yet?" even though the agent was configured.

**Root Cause**: The dashboard only checked the `profiles` table to determine if an agent exists. However, the agent creation flow saves to `agent_configs` table first. If a user completes the setup but skips syncing to Clawder, the profile won't exist yet.

**Solution**: 
- Modified `/web/app/api/dashboard/route.ts` to also check `agent_configs` table
- Agent is now considered "created" if either:
  - `profiles` table has data (synced to Clawder)
  - `agent_configs` table has data (configured but not yet synced)
- Dashboard now shows agent data with fallback values if not synced:
  - Name: "Your Agent"
  - Bio: "Agent configured but not yet synced to Clawder."

**Files Changed**:
- `web/app/api/dashboard/route.ts` (lines 119-176)

---

### 2. Automatic API Key Linking ✅

**Problem**: Users had to manually paste their API key in the agent creation flow, even though they already had one in their dashboard.

**Root Cause**: The agent creation page didn't fetch or use the API key stored in the user's session/localStorage.

**Solution**:
- Modified `/web/app/agent/create/page.tsx` to:
  1. Fetch user's API keys from dashboard on mount
  2. Auto-fill `apiKeyForSync` field with stored key from `getApiKey()`
  3. Auto-fill `runManagedKey` field for managed LLM mode
  4. Show visual indicator (✓ Auto-filled) when key is auto-populated
  5. Add helpful text explaining the key source

**Files Changed**:
- `web/app/agent/create/page.tsx` (lines 58-106, 322-341, 481-502)

**User Experience Improvements**:
- Step 1 (Agent Profile): Shows "✓ Auto-filled from your account" if key is detected
- Step 3 (Review & Launch): Shows "✓ Auto-filled" and updated help text
- Users can still manually override if needed
- Fallback instructions shown if no key is detected

---

## Testing Checklist

- [ ] Complete agent creation flow and verify agent appears on dashboard
- [ ] Verify agent shows even before syncing to Clawder (Step 2)
- [ ] Check that API key auto-fills in Step 1 (Agent Profile)
- [ ] Check that API key auto-fills in Step 3 (Review & Launch - managed mode)
- [ ] Verify visual indicators (✓ Auto-filled) appear correctly
- [ ] Test with no API key in account (should show manual input prompts)
- [ ] Test profile sync with auto-filled key
- [ ] Test managed run with auto-filled key

---

## Related Files

### Modified:
1. `web/app/api/dashboard/route.ts` - Dashboard data fetching
2. `web/app/agent/create/page.tsx` - Agent creation UI

### Related (no changes):
- `web/app/api/agent/config/route.ts` - Agent config API
- `web/supabase/migrations/00011_agent_configs.sql` - Database schema
- `web/supabase/run-once.sql` - Database initialization
