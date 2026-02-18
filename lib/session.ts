import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  getSessionExpiryMs,
  normalizeEmail,
} from "@/lib/auth";

const SESSION_COOKIE = "card_flasher_session";

export type CurrentUser = {
  id: number;
  email: string;
  targetLanguage: string;
};

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionTokenFromRequest(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUserFromCookies(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return getUserBySessionToken(token);
}

export function getUserByEmail(email: string) {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as
    | {
        id: number;
        email: string;
        password_hash: string;
        target_language: string;
      }
    | undefined;
}

export function createUser(email: string, passwordHash: string) {
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, target_language) VALUES (?, ?, 'Russian')",
    )
    .run(normalizeEmail(email), passwordHash);

  return result.lastInsertRowid as number;
}

export function updateUserTargetLanguage(userId: number, language: string) {
  db.prepare("UPDATE users SET target_language = ? WHERE id = ?").run(
    language.trim(),
    userId,
  );
}

export function createSession(userId: number) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiryMs();

  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expiresAt);

  return { token, expiresAt };
}

export function getUserBySessionToken(token: string): CurrentUser | null {
  const session = db
    .prepare(
      `
      SELECT users.id, users.email, users.target_language, sessions.expires_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      `,
    )
    .get(token) as
    | {
        id: number;
        email: string;
        target_language: string;
        expires_at: number;
      }
    | undefined;

  if (!session) {
    return null;
  }

  if (session.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    targetLanguage: session.target_language,
  };
}

export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function attachSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: number,
) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function listUserCards(userId: number) {
  return db
    .prepare(
      "SELECT id, phrase, translation, description_en, created_at FROM cards WHERE user_id = ? ORDER BY id DESC",
    )
    .all(userId) as Array<{
    id: number;
    phrase: string;
    translation: string;
    description_en: string;
    created_at: string;
  }>;
}

export function createCards(
  userId: number,
  cards: Array<{ phrase: string; translation: string; descriptionEn: string }>,
) {
  const insert = db.prepare(
    "INSERT INTO cards (user_id, phrase, translation, description_en) VALUES (?, ?, ?, ?)",
  );

  const transaction = db.transaction(() => {
    for (const card of cards) {
      insert.run(
        userId,
        card.phrase.trim(),
        card.translation.trim(),
        card.descriptionEn.trim(),
      );
    }
  });

  transaction();
}
