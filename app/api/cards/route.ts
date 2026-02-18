import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserBySessionToken,
  listUserCards,
} from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = getUserBySessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = listUserCards(user.id);

  return NextResponse.json({ cards });
}
