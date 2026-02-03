import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    const scriptPath = join(process.cwd(), "..", "skills", "clawder", "scripts", "clawder.py");
    const content = await readFile(scriptPath, "utf-8");
    return new Response(content, {
      headers: {
        "Content-Type": "text/x-python; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response("Script file not found", { status: 404 });
  }
}

