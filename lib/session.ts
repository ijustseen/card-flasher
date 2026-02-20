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

type DbCardGroup = {
  card_id: number;
  group_id: number;
};

type DbGroup = {
  id: number;
  name: string;
};

type DbGroupWithCount = {
  id: number;
  name: string;
  card_count: number | string;
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
        CREATE TABLE IF NOT EXISTS groups (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS card_groups (
          card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (card_id, group_id)
        )
      `;

      await sql`
        ALTER TABLE cards
        ADD COLUMN IF NOT EXISTS examples_en TEXT NOT NULL DEFAULT '[]'
      `;

      await sql`CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_card_groups_card_id ON card_groups(card_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_card_groups_group_id ON card_groups(group_id)`;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_user_name_unique
        ON groups(user_id, LOWER(name))
      `;
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

  const cardGroups = await sql<DbCardGroup[]>`
    SELECT card_groups.card_id, card_groups.group_id
    FROM card_groups
    INNER JOIN cards ON cards.id = card_groups.card_id
    WHERE cards.user_id = ${userId}
  `;

  const groupIdsByCard = new Map<number, number[]>();

  for (const cardGroup of cardGroups) {
    const cardId = Number(cardGroup.card_id);
    const groupId = Number(cardGroup.group_id);
    const current = groupIdsByCard.get(cardId) ?? [];
    current.push(groupId);
    groupIdsByCard.set(cardId, current);
  }

  return cards.map((card) => ({
    id: Number(card.id),
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
    groupIds: groupIdsByCard.get(Number(card.id)) ?? [],
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
  groupIds: number[] = [],
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const normalizedGroupIds = [...new Set(groupIds)]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  for (const card of cards) {
    const phrase = card.phrase.trim();

    const inserted = await sql<{ id: number }[]>`
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
      RETURNING id
    `;

    const cardId = inserted[0]?.id;

    if (!cardId || normalizedGroupIds.length === 0) {
      continue;
    }

    await sql`
      INSERT INTO card_groups (card_id, group_id)
      SELECT ${cardId}, groups.id
      FROM groups
      WHERE groups.user_id = ${userId}
        AND groups.id = ANY(${sql.array(normalizedGroupIds)}::bigint[])
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function listUserGroups(userId: number) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const groups = await sql<DbGroupWithCount[]>`
    SELECT groups.id, groups.name, COUNT(card_groups.card_id) AS card_count
    FROM groups
    LEFT JOIN card_groups ON card_groups.group_id = groups.id
    WHERE groups.user_id = ${userId}
    GROUP BY groups.id, groups.name
    ORDER BY groups.name ASC
  `;

  const unsortedRows = await sql<{ count: number | string }[]>`
    SELECT COUNT(cards.id) AS count
    FROM cards
    LEFT JOIN card_groups ON card_groups.card_id = cards.id
    WHERE cards.user_id = ${userId}
      AND card_groups.card_id IS NULL
  `;

  return {
    groups: groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      cardCount: Number(group.card_count),
    })),
    unsortedCount: Number(unsortedRows[0]?.count ?? 0),
  };
}

export async function createUserGroup(userId: number, rawName: string) {
  const name = rawName.trim();

  if (!name) {
    throw new Error("Group name is required.");
  }

  if (name.toLocaleLowerCase() === "all") {
    throw new Error('Group name "all" is reserved.');
  }

  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  const inserted = await sql<DbGroup[]>`
    INSERT INTO groups (user_id, name)
    VALUES (${userId}, ${name})
    ON CONFLICT (user_id, LOWER(name)) DO NOTHING
    RETURNING id, name
  `;

  if (inserted[0]) {
    return {
      id: Number(inserted[0].id),
      name: inserted[0].name,
    };
  }

  const existing = await sql<DbGroup[]>`
    SELECT id, name
    FROM groups
    WHERE user_id = ${userId}
      AND LOWER(name) = LOWER(${name})
    LIMIT 1
  `;

  if (!existing[0]) {
    throw new Error("Failed to create group.");
  }

  return {
    id: Number(existing[0].id),
    name: existing[0].name,
  };
}

export async function addCardsToGroup(
  userId: number,
  cardIds: number[],
  groupId: number,
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  if (cardIds.length === 0) {
    return 0;
  }

  const rows = await sql<{ card_id: number }[]>`
    INSERT INTO card_groups (card_id, group_id)
    SELECT cards.id, groups.id
    FROM cards
    INNER JOIN groups ON groups.id = ${groupId}
    WHERE cards.user_id = ${userId}
      AND groups.user_id = ${userId}
      AND cards.id = ANY(${sql.array(cardIds)}::bigint[])
    ON CONFLICT DO NOTHING
    RETURNING card_id
  `;

  return rows.length;
}

export async function removeCardsFromGroup(
  userId: number,
  cardIds: number[],
  groupId: number,
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  if (cardIds.length === 0) {
    return 0;
  }

  const rows = await sql<{ card_id: number }[]>`
    DELETE FROM card_groups
    USING cards, groups
    WHERE card_groups.card_id = cards.id
      AND card_groups.group_id = groups.id
      AND cards.user_id = ${userId}
      AND groups.user_id = ${userId}
      AND groups.id = ${groupId}
      AND cards.id = ANY(${sql.array(cardIds)}::bigint[])
    RETURNING card_groups.card_id
  `;

  return rows.length;
}

export async function moveCardsToGroup(
  userId: number,
  cardIds: number[],
  groupId: number,
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  if (cardIds.length === 0) {
    return 0;
  }

  const targetGroup = await sql<{ id: number }[]>`
    SELECT id
    FROM groups
    WHERE id = ${groupId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!targetGroup[0]) {
    throw new Error("Group not found.");
  }

  await sql`
    DELETE FROM card_groups
    USING cards
    WHERE card_groups.card_id = cards.id
      AND cards.user_id = ${userId}
      AND cards.id = ANY(${sql.array(cardIds)}::bigint[])
  `;

  return await addCardsToGroup(userId, cardIds, groupId);
}

export async function deleteUserCards(userId: number, cardIds: number[]) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  if (cardIds.length === 0) {
    return 0;
  }

  const rows = await sql<{ id: number }[]>`
    DELETE FROM cards
    WHERE user_id = ${userId}
      AND id = ANY(${sql.array(cardIds)}::bigint[])
    RETURNING id
  `;

  return rows.length;
}

export async function getUserCardsByIds(userId: number, cardIds: number[]) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  if (cardIds.length === 0) {
    return [];
  }

  return await sql<DbCard[]>`
    SELECT id, phrase, translation, description_en, examples_en, created_at
    FROM cards
    WHERE user_id = ${userId}
      AND id = ANY(${sql.array(cardIds)}::bigint[])
  `;
}

export async function updateUserCardContent(
  userId: number,
  cardId: number,
  nextCard: {
    phrase: string;
    translation: string;
    descriptionEn: string;
    examplesEn: string[];
  },
) {
  await ensurePostgresSchema();
  const sql = getPostgresClient();

  if (!sql) {
    throw new Error("Postgres client is not configured.");
  }

  await sql`
    UPDATE cards
    SET phrase = ${nextCard.phrase.trim()},
        translation = ${nextCard.translation.trim()},
        description_en = ${nextCard.descriptionEn.trim()},
        examples_en = ${JSON.stringify(
          nextCard.examplesEn
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 2),
        )}
    WHERE id = ${cardId} AND user_id = ${userId}
  `;
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
