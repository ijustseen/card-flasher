import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const generatedCardSchema = z.object({
  phrase: z.string().min(1),
  translation: z.string().min(1),
  descriptionEn: z.string().min(1),
  examplesEn: z.array(z.string().min(1)).length(2),
});

const generatedExamplesSchema = z.array(z.string().min(1)).length(2);

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
  3) examplesEn: exactly 2 short, natural example sentences in English

Rules:
- Normalize each input to its base dictionary form before returning "phrase":
  - verbs -> infinitive/base form (e.g., "went" -> "go", "running" -> "run")
  - nouns -> singular base form when applicable
  - short phrases -> canonical/base wording while preserving original meaning
- descriptionEn must always be in English.
- examplesEn must always be in English and contain exactly 2 items.
- Return strict JSON array only. No markdown. No code fences.
- JSON schema per item:
  {
    "phrase": "string",
    "translation": "string",
    "descriptionEn": "string",
    "examplesEn": ["string", "string"]
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

export async function generateExamplesForPhrase(phrase: string) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You generate English usage examples for a flash card.

Task:
- Create exactly 2 short, natural English example sentences for this phrase/word:
  "${phrase.trim()}"

Rules:
- Return strict JSON array only.
- No markdown. No code fences.
- Exactly 2 string items.

Output format:
["example sentence 1", "example sentence 2"]
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

  return generatedExamplesSchema.parse(parsed);
}
