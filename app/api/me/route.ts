import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api-route";
import { updateUserTargetLanguage } from "@/lib/session";

export const runtime = "nodejs";

const updateSchema = z.object({
  targetLanguage: z.string().trim().min(2).max(60),
});

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json({
    id: auth.user.id,
    email: auth.user.email,
    targetLanguage: auth.user.targetLanguage,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const json = await request.json();
    const { targetLanguage } = updateSchema.parse(json);

    await updateUserTargetLanguage(auth.user.id, targetLanguage);

    return NextResponse.json({ ok: true, targetLanguage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    return jsonError(message, 400);
  }
}
