/**
 * Verify tweet contains nonce via Twitter/X oEmbed (no API key required)
 */
export type TweetOembedVerification = { ok: boolean; twitter_handle: string | null };

function extractHandleFromAuthorUrl(authorUrl: unknown): string | null {
  if (typeof authorUrl !== "string") return null;
  try {
    const u = new URL(authorUrl);
    // Typically: https://twitter.com/<handle>
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (!seg) return null;
    const handle = seg.replace(/^@/, "").trim().toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
  } catch {
    return null;
  }
}

export async function verifyTweetContainsNonce(tweetUrl: string, nonce: string): Promise<TweetOembedVerification> {
  const encoded = encodeURIComponent(tweetUrl);
  const url = `https://publish.twitter.com/oembed?url=${encoded}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return { ok: false, twitter_handle: null };
  const data = (await res.json()) as { html?: string; author_url?: string };
  const html = data?.html ?? "";
  const ok = typeof html === "string" && html.includes(nonce);
  const twitter_handle = extractHandleFromAuthorUrl(data?.author_url);
  return { ok, twitter_handle };
}
