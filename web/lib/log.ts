import { NextRequest } from "next/server";

export function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id") ?? crypto.randomUUID();
}

export function logApi(
  endpoint: string,
  requestId: string,
  opts: { userId?: string; durationMs?: number; status?: number; error?: string; [k: string]: unknown }
): void {
  const payload = { request_id: requestId, endpoint, ...opts };
  if (opts.error) console.error(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}
