import { NextRequest, NextResponse } from "next/server";
import {
  type CurrentUser,
  getSessionTokenFromRequest,
  getUserBySessionToken,
} from "@/lib/session";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(payload: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(payload);
}

export async function requireUser(
  request: NextRequest,
): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return { response: jsonError("Unauthorized", 401) };
  }

  const user = await getUserBySessionToken(token);

  if (!user) {
    return { response: jsonError("Unauthorized", 401) };
  }

  return { user };
}
