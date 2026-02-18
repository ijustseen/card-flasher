import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getSessionTokenFromRequest,
  getUserBySessionToken,
  updateUserTargetLanguage,
} from "@/lib/session";

export const runtime = "nodejs";

const updateSchema = z.object({
  targetLanguage: z.string().trim().min(2).max(60),
});

function getAuthenticatedUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return getUserBySessionToken(token);
}

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    targetLanguage: user.targetLanguage,
  });
}

export async function PATCH(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { targetLanguage } = updateSchema.parse(json);

    updateUserTargetLanguage(user.id, targetLanguage);

    return NextResponse.json({ ok: true, targetLanguage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
