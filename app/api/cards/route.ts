import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-route";
import { listUserCards } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);

    if ("response" in auth) {
      return auth.response;
    }

    const cards = await listUserCards(auth.user.id);

    return NextResponse.json({ cards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load cards.";
    return jsonError(message, 500);
  }
}
