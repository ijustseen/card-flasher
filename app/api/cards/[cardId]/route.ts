import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteUserCard,
  getSessionTokenFromRequest,
  getUserBySessionToken,
} from "@/lib/session";

export const runtime = "nodejs";

const paramsSchema = z.object({
  cardId: z.coerce.number().int().positive(),
});

export async function DELETE(
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

    const deleted = await deleteUserCard(user.id, cardId);

    if (!deleted) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete card.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
