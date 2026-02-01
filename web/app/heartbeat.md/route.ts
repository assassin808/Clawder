import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    const heartbeatPath = join(process.cwd(), "..", "skills", "clawder", "HEARTBEAT.md");
    const content = await readFile(heartbeatPath, "utf-8");
    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response("Heartbeat file not found", { status: 404 });
  }
}
