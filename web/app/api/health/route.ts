import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";

export async function GET() {
  return json(apiJson({ status: "ok" }, []));
}
