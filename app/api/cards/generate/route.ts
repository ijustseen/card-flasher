import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCardsFromPhrases } from "@/lib/google-ai";
import {
  createCards,
  getSessionTokenFromRequest,
  getUserBySessionToken,
  updateUserTargetLanguage,
} from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  targetLanguage: z.string().trim().min(2).max(60),
  phrases: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { phrases, targetLanguage } = schema.parse(json);

    const generatedCards = await generateCardsFromPhrases(
      phrases,
      targetLanguage,
    );

    await createCards(user.id, generatedCards);
    await updateUserTargetLanguage(user.id, targetLanguage);

    return NextResponse.json({ count: generatedCards.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate cards.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
