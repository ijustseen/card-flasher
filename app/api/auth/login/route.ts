import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth";
import {
  attachSessionCookie,
  createSession,
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

    const user = getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const session = createSession(user.id);
    const response = NextResponse.json({ ok: true });

    attachSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to login.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
