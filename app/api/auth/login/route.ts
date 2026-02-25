import { z } from "zod";
import { verifyPassword } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-route";
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

    const user = await getUserByEmail(email);

    if (!user) {
      return jsonError("Invalid credentials.", 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return jsonError("Invalid credentials.", 401);
    }

    const session = await createSession(user.id);
    const response = jsonOk();

    attachSessionCookie(response, session.token, session.expiresAt);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to login.";
    return jsonError(message, 400);
  }
}
