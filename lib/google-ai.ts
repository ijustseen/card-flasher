import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const generatedCardSchema = z.object({
  phrase: z.string().min(1),
  translation: z.string().min(1),
  descriptionEn: z.string().min(1),
});

const generatedCardsSchema = z.array(generatedCardSchema);

export async function generateCardsFromPhrases(
  phrases: string[],
  targetLanguage: string,
) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const cleanPhrases = phrases.map((value) => value.trim()).filter(Boolean);

  const prompt = `
You are generating flash cards for English learning.

Task:
- For each input English phrase/word, generate:
  1) translation: translate to ${targetLanguage}
  2) descriptionEn: concise explanation in English (meaning + usage context)

Rules:
- Keep phrase unchanged from the input.
- descriptionEn must always be in English.
- Return strict JSON array only. No markdown. No code fences.
- JSON schema per item:
  {
    "phrase": "string",
    "translation": "string",
    "descriptionEn": "string"
  }

Input phrases:
${JSON.stringify(cleanPhrases, null, 2)}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;

  if (!text) {
    throw new Error("Google model returned empty response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  }

  return generatedCardsSchema.parse(parsed);
}
