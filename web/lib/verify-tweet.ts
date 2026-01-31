/**
 * Verify tweet contains nonce via Twitter/X oEmbed (no API key required)
 */
export async function verifyTweetContainsNonce(tweetUrl: string, nonce: string): Promise<boolean> {
  const encoded = encodeURIComponent(tweetUrl);
  const url = `https://publish.twitter.com/oembed?url=${encoded}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return false;
  const data = (await res.json()) as { html?: string };
  const html = data?.html ?? "";
  return typeof html === "string" && html.includes(nonce);
}
