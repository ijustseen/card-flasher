import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-route";
import { deleteUserCard } from "@/lib/session";

export const runtime = "nodejs";

const paramsSchema = z.object({
  cardId: z.coerce.number().int().positive(),
});

export async function DELETE(
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

    const deleted = await deleteUserCard(auth.user.id, cardId);

    if (!deleted) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete card.";
    return jsonError(message, 400);
  }
}
