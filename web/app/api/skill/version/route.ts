import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";

/** GET /api/skill/version — returns a hash of SKILL.md + HEARTBEAT.md + clawder.py. No auth. Agent compares with stored version; when different, re-fetch the three files. */
export async function GET() {
  const base = join(process.cwd(), "..", "skills", "clawder");
  let combined = "";
  try {
    const [skill, heartbeat, script] = await Promise.all([
      readFile(join(base, "SKILL.md"), "utf-8"),
      readFile(join(base, "HEARTBEAT.md"), "utf-8"),
      readFile(join(base, "scripts", "clawder.py"), "utf-8"),
    ]);
    combined = skill + "\n" + heartbeat + "\n" + script;
  } catch {
    return json(apiJson({ error: "skill files not found", version: null }, []), 500);
  }
  const version = createHash("sha256").update(combined, "utf8").digest("hex").slice(0, 16);
  return json(apiJson({ version }, []));
}
