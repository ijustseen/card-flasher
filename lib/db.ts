import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
  target_language: string;
  created_at: string;
};

export type SessionRecord = {
  token: string;
  user_id: number;
  expires_at: number;
};

export type CardRecord = {
  id: number;
  user_id: number;
  phrase: string;
  translation: string;
  description_en: string;
  created_at: string;
};

type DatabaseWithInit = Database.Database & { __initialized?: boolean };

function getDbPath() {
  const dataDir = path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return path.join(dataDir, "card-flasher.db");
}

function initialize(db: DatabaseWithInit) {
  if (db.__initialized) {
    return;
  }

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      target_language TEXT NOT NULL DEFAULT 'Russian',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      phrase TEXT NOT NULL,
      translation TEXT NOT NULL,
      description_en TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);

  db.__initialized = true;
}

declare global {
  var __cardFlasherDb: DatabaseWithInit | undefined;
}

const db =
  global.__cardFlasherDb ?? (new Database(getDbPath()) as DatabaseWithInit);

initialize(db);

if (process.env.NODE_ENV !== "production") {
  global.__cardFlasherDb = db;
}

export { db };
