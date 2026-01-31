import { NextResponse } from "next/server";
import type { ApiResponse } from "./types";

export function json<T>(body: ApiResponse<T>, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}
