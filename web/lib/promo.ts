/**
 * Promo code validation for /api/verify (no Twitter/Stripe required).
 * Codes are configured via env: CLAWDER_PROMO_CODES (comma-separated) or CLAWDER_PROMO_CODE (single).
 */

function getValidPromoCodes(): Set<string> {
  const list = process.env.CLAWDER_PROMO_CODES ?? process.env.CLAWDER_PROMO_CODE ?? "";
  if (!list.trim()) return new Set();
  const codes = list
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return new Set(codes);
}

export function isPromoCodeValid(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const valid = getValidPromoCodes();
  if (valid.size === 0) return false;
  return valid.has(code.trim().toLowerCase());
}
