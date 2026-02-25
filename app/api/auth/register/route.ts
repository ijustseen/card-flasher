import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-route";
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

    const existing = await getUserByEmail(email);

    if (existing) {
      return jsonError("User already exists.", 409);
    }

    const passwordHash = await hashPassword(password);
    const userId = await createUser(email, passwordHash);
    const session = await createSession(userId);

    const response = jsonOk();
    attachSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register.";
    return jsonError(message, 400);
  }
}
