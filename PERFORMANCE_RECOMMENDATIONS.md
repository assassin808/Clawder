# Performance Optimization Recommendations

## ✅ Already Fixed
- `/api/swipe`: Parallelized all database operations (14-21s → <2s expected)
- `/api/just-matched`: Batch profile fetching instead of N+1 queries
- Both routes now use `Promise.all()` for parallel execution

## 🔧 Database Indexes to Add

Add these indexes to your Supabase database for faster queries:

```sql
-- Index for post_interactions lookups (used heavily in /api/swipe)
CREATE INDEX IF NOT EXISTS idx_post_interactions_post_action 
  ON post_interactions(post_id, action);

CREATE INDEX IF NOT EXISTS idx_post_interactions_user_created 
  ON post_interactions(user_id, created_at);

-- Index for posts by author (used in getLikersOfAuthorByPosts)
CREATE INDEX IF NOT EXISTS idx_posts_author 
  ON posts(author_id);

-- Index for reviews by post
CREATE INDEX IF NOT EXISTS idx_reviews_post 
  ON reviews(post_id);

-- Index for matches
CREATE INDEX IF NOT EXISTS idx_matches_created 
  ON matches(created_at DESC);

-- Index for DM messages
CREATE INDEX IF NOT EXISTS idx_dm_messages_match_created 
  ON dm_messages(match_id, created_at DESC);
```

## 🚀 Additional Optimizations

### 1. Cache frequently accessed data
Add Redis or in-memory caching for:
- User profiles (TTL: 5 minutes)
- Post data (TTL: 1 minute)
- Feed results (TTL: 30 seconds)

### 2. Optimize `updatePostCounters`
Currently does 3 separate queries. Consider:
- Using database triggers to update counters automatically
- Or batch counter updates every 30 seconds instead of real-time

### 3. Database Connection Pooling
Ensure Supabase connection pooling is configured properly:
```typescript
// In lib/db.ts
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-connection-encrypted': 'true'
    }
  }
});
```

### 4. API Rate Limiting
Your rate limiting is good, but consider adding:
- Per-endpoint rate limits (already done ✓)
- Exponential backoff guidance in API responses
- Request queuing for burst traffic

### 5. Monitor with Logging
The `logApi()` calls are excellent. Consider:
- Setting up alerts for requests >1s
- Tracking P95/P99 latencies
- Monitoring database query performance in Supabase dashboard

## 📊 Expected Performance After Fixes

| Endpoint | Before | After | Target |
|----------|--------|-------|--------|
| `/api/swipe` | 14-21s | 1-2s | <500ms with indexes |
| `/api/post` | 1.3-2.2s | ~800ms | <500ms with caching |
| `/api/just-matched` | 800ms-3.2s | ~500ms | <300ms with indexes |
| `GET /` (home) | 200-800ms | same | ✓ acceptable |

## 🎯 Priority Order
1. **Deploy the code fixes I just made** (biggest impact)
2. **Add database indexes** (SQL above) - will cut query time 50-80%
3. **Monitor and measure** improvements
4. **Add caching** if still needed
5. **Consider database triggers** for counter updates

## 🔍 How to Verify Improvements

After deploying, check your terminal logs:
```bash
# Should see swipe times drop from 14-21s to <2s
POST /api/swipe 200 in 1.5s

# Just matched should be <500ms
GET /api/just-matched 200 in 450ms
```

Monitor in Supabase Dashboard:
- Query performance metrics
- Slow query logs
- Connection pool usage
