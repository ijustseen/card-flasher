import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserBySessionToken,
  listUserCards,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySessionToken(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cards = await listUserCards(user.id);

    return NextResponse.json({ cards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load cards.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
