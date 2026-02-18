import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import {
  attachSessionCookie,
  createSession,
  createUser,
  getUserByEmail,
} from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { email, password } = schema.parse(json);

    const existing = getUserByEmail(email);

    if (existing) {
      return NextResponse.json(
        { error: "User already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = createUser(email, passwordHash);
    const session = createSession(userId);

    const response = NextResponse.json({ ok: true });
    attachSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
