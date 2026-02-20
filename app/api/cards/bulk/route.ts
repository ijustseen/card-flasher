import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCardsFromPhrases } from "@/lib/google-ai";
import {
  addCardsToGroup,
  deleteUserCards,
  getSessionTokenFromRequest,
  getUserBySessionToken,
  getUserCardsByIds,
  moveCardsToGroup,
  removeCardsFromGroup,
  updateUserCardContent,
} from "@/lib/session";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete"),
    cardIds: z.array(z.number().int().positive()).min(1).max(500),
  }),
  z.object({
    action: z.literal("addToGroup"),
    cardIds: z.array(z.number().int().positive()).min(1).max(500),
    groupId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("removeFromGroup"),
    cardIds: z.array(z.number().int().positive()).min(1).max(500),
    groupId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("moveToGroup"),
    cardIds: z.array(z.number().int().positive()).min(1).max(500),
    groupId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("regenerate"),
    cardIds: z.array(z.number().int().positive()).min(1).max(50),
    targetLanguage: z.string().trim().min(2).max(60),
  }),
]);

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
    const input = schema.parse(await request.json());

    if (input.action === "delete") {
      const count = await deleteUserCards(user.id, input.cardIds);
      return NextResponse.json({ count });
    }

    if (input.action === "addToGroup") {
      const count = await addCardsToGroup(
        user.id,
        input.cardIds,
        input.groupId,
      );
      return NextResponse.json({ count });
    }

    if (input.action === "removeFromGroup") {
      const count = await removeCardsFromGroup(
        user.id,
        input.cardIds,
        input.groupId,
      );
      return NextResponse.json({ count });
    }

    if (input.action === "moveToGroup") {
      const count = await moveCardsToGroup(
        user.id,
        input.cardIds,
        input.groupId,
      );
      return NextResponse.json({ count });
    }

    const cards = await getUserCardsByIds(user.id, input.cardIds);
    let count = 0;

    for (const card of cards) {
      const generated = await generateCardsFromPhrases(
        [card.phrase],
        input.targetLanguage,
      );
      const next = generated[0];

      if (!next) {
        continue;
      }

      await updateUserCardContent(user.id, card.id, next);
      count += 1;
    }

    return NextResponse.json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process bulk action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
