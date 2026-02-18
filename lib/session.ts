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
const usePostgres = Boolean(postgresUrl);

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
  created_at: string | Date;
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

async function ensurePostgresSchema() {
  if (!usePostgres) {
    return;
  }

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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
    })();
  }

  await global.__cardFlasherPostgresReady;
}

async function getSqliteDb() {
  const sqliteModule = await import("@/lib/db");
  return sqliteModule.db;
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

  if (usePostgres) {
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

  const db = await getSqliteDb();
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail) as DbUser | undefined;
}

export async function createUser(email: string, passwordHash: string) {
  const normalizedEmail = normalizeEmail(email);

  if (usePostgres) {
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

  const db = await getSqliteDb();
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, target_language) VALUES (?, ?, 'Russian')",
    )
    .run(normalizedEmail, passwordHash);

  return result.lastInsertRowid as number;
}

export async function updateUserTargetLanguage(
  userId: number,
  language: string,
) {
  const cleanedLanguage = language.trim();

  if (usePostgres) {
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
    return;
  }

  const db = await getSqliteDb();
  db.prepare("UPDATE users SET target_language = ? WHERE id = ?").run(
    cleanedLanguage,
    userId,
  );
}

export async function createSession(userId: number) {
  const token = createSessionToken();
  const expiresAt = getSessionExpiryMs();

  if (usePostgres) {
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

  const db = await getSqliteDb();
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expiresAt);

  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
): Promise<CurrentUser | null> {
  let session: DbSessionUser | undefined;

  if (usePostgres) {
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
    session = rows[0];
  } else {
    const db = await getSqliteDb();
    session = db
      .prepare(
        `
      SELECT users.id, users.email, users.target_language, sessions.expires_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      `,
      )
      .get(token) as DbSessionUser | undefined;
  }

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
  if (usePostgres) {
    await ensurePostgresSchema();
    const sql = getPostgresClient();

    if (!sql) {
      throw new Error("Postgres client is not configured.");
    }

    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return;
  }

  const db = await getSqliteDb();
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

export async function listUserCards(userId: number) {
  if (usePostgres) {
    await ensurePostgresSchema();
    const sql = getPostgresClient();

    if (!sql) {
      throw new Error("Postgres client is not configured.");
    }

    const cards = await sql<DbCard[]>`
      SELECT id, phrase, translation, description_en, created_at
      FROM cards
      WHERE user_id = ${userId}
      ORDER BY id DESC
    `;

    return cards.map((card) => ({
      ...card,
      created_at:
        card.created_at instanceof Date
          ? card.created_at.toISOString()
          : String(card.created_at),
    }));
  }

  const db = await getSqliteDb();
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

export async function createCards(
  userId: number,
  cards: Array<{ phrase: string; translation: string; descriptionEn: string }>,
) {
  if (usePostgres) {
    await ensurePostgresSchema();
    const sql = getPostgresClient();

    if (!sql) {
      throw new Error("Postgres client is not configured.");
    }

    for (const card of cards) {
      await sql`
        INSERT INTO cards (user_id, phrase, translation, description_en)
        VALUES (${userId}, ${card.phrase.trim()}, ${card.translation.trim()}, ${card.descriptionEn.trim()})
      `;
    }
    return;
  }

  const db = await getSqliteDb();
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
