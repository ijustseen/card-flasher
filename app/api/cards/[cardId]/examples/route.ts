import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-route";
import { generateExamplesForPhrase } from "@/lib/google-ai";
import { getUserCardPhrase, updateCardExamples } from "@/lib/session";

export const runtime = "nodejs";

const paramsSchema = z.object({
  cardId: z.coerce.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ cardId: string }> },
) {
  const auth = await requireUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const { cardId } = paramsSchema.parse(params);

    const phrase = await getUserCardPhrase(auth.user.id, cardId);

    if (!phrase) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    const examplesEn = await generateExamplesForPhrase(phrase);
    await updateCardExamples(auth.user.id, cardId, examplesEn);

    return NextResponse.json({ examplesEn });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate examples.";
    return jsonError(message, 400);
  }
}
