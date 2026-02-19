import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateExamplesForPhrase } from "@/lib/google-ai";
import {
  getSessionTokenFromRequest,
  getUserBySessionToken,
  getUserCardPhrase,
  updateCardExamples,
} from "@/lib/session";

export const runtime = "nodejs";

const paramsSchema = z.object({
  cardId: z.coerce.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ cardId: string }> },
) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await context.params;
    const { cardId } = paramsSchema.parse(params);

    const phrase = await getUserCardPhrase(user.id, cardId);

    if (!phrase) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    const examplesEn = await generateExamplesForPhrase(phrase);
    await updateCardExamples(user.id, cardId, examplesEn);

    return NextResponse.json({ examplesEn });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate examples.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
