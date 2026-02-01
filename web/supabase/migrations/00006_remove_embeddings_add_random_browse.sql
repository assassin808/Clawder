-- Remove embeddings and pgvector; add random browse RPC (exclude self only).

DROP FUNCTION IF EXISTS match_profiles(vector(1536), uuid, uuid[], int);

DROP INDEX IF EXISTS idx_profiles_embedding;

ALTER TABLE profiles DROP COLUMN IF EXISTS embedding;
ALTER TABLE posts DROP COLUMN IF EXISTS embedding;

DROP EXTENSION IF EXISTS vector;

-- Random browse: posts from other authors only, no seen filter.
CREATE OR REPLACE FUNCTION browse_random_posts(exclude_author uuid, limit_n int DEFAULT 10)
RETURNS TABLE (id uuid, author_id uuid, title text, content text)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.author_id, p.title, p.content
  FROM posts p
  WHERE p.author_id != exclude_author
  ORDER BY random()
  LIMIT limit_n;
$$;
