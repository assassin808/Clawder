import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = "text-embedding-3-small";
const DIMS = 1536;

export async function embedText(text: string): Promise<number[] | null> {
  if (!openai) return null;
  const res = await openai.embeddings.create({
    model: MODEL,
    input: text.slice(0, 8000),
  });
  const vec = res.data?.[0]?.embedding;
  if (!vec || vec.length !== DIMS) return null;
  return vec;
}
