import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { generateCardsFromPhrases } from "@/lib/google-ai";
import {
  createCards,
  getSessionTokenFromRequest,
  getUserBySessionToken,
  updateUserTargetLanguage,
} from "@/lib/session";

export const runtime = "nodejs";
const GENERATION_BATCH_SIZE = 50;

const schema = z.object({
  targetLanguage: z.string().trim().min(2).max(60),
  phrases: z.array(z.string().trim().min(1).max(160)).min(1).max(1000),
  groupIds: z.array(z.number().int().positive()).max(100).optional(),
});

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySessionToken(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { phrases, targetLanguage, groupIds = [] } = schema.parse(json);

    const phraseBatches = chunkArray(phrases, GENERATION_BATCH_SIZE);
    let totalGenerated = 0;

    for (const phraseBatch of phraseBatches) {
      const generatedCards = await generateCardsFromPhrases(
        phraseBatch,
        targetLanguage,
      );

      await createCards(user.id, generatedCards, groupIds);
      totalGenerated += generatedCards.length;
    }

    await updateUserTargetLanguage(user.id, targetLanguage);

    return NextResponse.json({ count: totalGenerated });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input data.", details: error.issues },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate cards.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
