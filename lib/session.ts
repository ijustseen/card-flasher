import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import postgres, { type Sql } from "postgres";
import {
  createSessionToken,
  getSessionExpiryMs,
  normalizeEmail,
} from "@/lib/auth";

const SESSION_COOKIE = "card_flasher_session";
const postgresUrl =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
const MISSING_DB_ENV_MESSAGE =
  "Missing DATABASE_URL/POSTGRES_URL. This project uses Neon Postgres only.";

export type CurrentUser = {
  id: number;
  email: string;
  targetLanguage: string;
};

type DbUser = {
  id: number;
  email: string;
  password_hash: string;
  target_language: string;
};

type DbSessionUser = {
  id: number;
  email: string;
  target_language: string;
  expires_at: number;
};

type DbCard = {
  id: number;
  phrase: string;
  translation: string;
  description_en: string;
  examples_en: string;
  created_at: string | Date;
};

type DbCardPhrase = {
  phrase: string;
};

declare global {
  var __cardFlasherPostgresClient: Sql | undefined;
  var __cardFlasherPostgresReady: Promise<void> | undefined;
}

function getPostgresClient() {
  if (!postgresUrl) {
    return null;
  }

  if (!global.__cardFlasherPostgresClient) {
    global.__cardFlasherPostgresClient = postgres(postgresUrl, {
      ssl: "require",
      prepare: false,
      max: 1,
    });
  }

  return global.__cardFlasherPostgresClient;
}

export function isDatabaseConfigured() {
  return Boolean(postgresUrl);
}

function assertDatabaseConfigured() {
  if (!postgresUrl) {
    throw new Error(MISSING_DB_ENV_MESSAGE);
  }
}

async function ensurePostgresSchema() {
  assertDatabaseConfigured();

  if (!global.__cardFlasherPostgresReady) {
    const sql = getPostgresClient();

    if (!sql) {
      throw new Error("Postgres client is not configured.");
    }

    global.__cardFlasherPostgresReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          target_language TEXT NOT NULL DEFAULT 'Russian',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at BIGINT NOT NULL
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS cards (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          phrase TEXT NOT NULL,
          translation TEXT NOT NULL,
          description_en TEXT NOT NULL,
          examples_en TEXT NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        ALTER TABLE cards
        ADD COLUMN IF NOT EXISTS examples_en TEXT NOT NULL DEFAULT '[]'
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
    })();
  }

  await global.__cardFlasherPostgresReady;
}

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

  return await getUserBySessionToken(token);
}

export async function getUserByEmail(
  email: string,
): Promise<DbUser | undefined> {
  const normalizedEmail = normalizeEmail(email);
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const users = await sql<DbUser[]>`
    SELECT id, email, password_hash, target_language
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  return users[0];
}

export async function createUser(email: string, passwordHash: string) {
  const normalizedEmail = normalizeEmail(email);
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, target_language)
    VALUES (${normalizedEmail}, ${passwordHash}, 'Russian')
    RETURNING id
  `;

  return Number(inserted[0].id);
}

export async function updateUserTargetLanguage(
  userId: number,
  language: string,
) {
  const cleanedLanguage = language.trim();
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  await sql`
    UPDATE users
    SET target_language = ${cleanedLanguage}
    WHERE id = ${userId}
  `;
}

export async function createSession(userId: number) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiryMs();
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt})
  `;

  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
): Promise<CurrentUser | null> {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const rows = await sql<DbSessionUser[]>`
    SELECT users.id, users.email, users.target_language, sessions.expires_at
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
    LIMIT 1
  `;
  const session = rows[0];

  if (!session) {
    return null;
  }

  if (session.expires_at < Date.now()) {
    await deleteSession(token);
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    targetLanguage: session.target_language,
  };
}

export async function deleteSession(token: string) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  await sql`DELETE FROM sessions WHERE token = ${token}`;
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

export async function listUserCards(userId: number) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const cards = await sql<DbCard[]>`
    SELECT id, phrase, translation, description_en, examples_en, created_at
    FROM cards
    WHERE user_id = ${userId}
    ORDER BY id DESC
  `;

  return cards.map((card) => ({
    id: card.id,
    phrase: card.phrase,
    translation: card.translation,
    description_en: card.description_en,
    examples_en: (() => {
      try {
        const parsed = JSON.parse(card.examples_en);
        return Array.isArray(parsed)
          ? parsed.filter((value) => typeof value === "string")
          : [];
      } catch {
        return [];
      }
    })(),
    created_at:
      card.created_at instanceof Date
        ? card.created_at.toISOString()
        : String(card.created_at),
  }));
}

export async function createCards(
  userId: number,
  cards: Array<{
    phrase: string;
    translation: string;
    descriptionEn: string;
    examplesEn: string[];
  }>,
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  for (const card of cards) {
    const phrase = card.phrase.trim();

    await sql`
      INSERT INTO cards (user_id, phrase, translation, description_en, examples_en)
      SELECT
        ${userId},
        ${phrase},
        ${card.translation.trim()},
        ${card.descriptionEn.trim()},
        ${JSON.stringify(
          card.examplesEn
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 2),
        )}
      WHERE NOT EXISTS (
        SELECT 1
        FROM cards
        WHERE user_id = ${userId}
          AND LOWER(phrase) = LOWER(${phrase})
      )
    `;
  }
}

export async function getUserCardPhrase(userId: number, cardId: number) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const rows = await sql<DbCardPhrase[]>`
    SELECT phrase
    FROM cards
    WHERE id = ${cardId} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0]?.phrase ?? null;
}

export async function updateCardExamples(
  userId: number,
  cardId: number,
  examplesEn: string[],
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  await sql`
    UPDATE cards
    SET examples_en = ${JSON.stringify(
      examplesEn
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 2),
    )}
    WHERE id = ${cardId} AND user_id = ${userId}
  `;
}

export async function deleteUserCard(userId: number, cardId: number) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const rows = await sql<{ id: number }[]>`
    DELETE FROM cards
    WHERE id = ${cardId} AND user_id = ${userId}
    RETURNING id
  `;

  return rows.length > 0;
}
