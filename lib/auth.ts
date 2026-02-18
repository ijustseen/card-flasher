import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SESSION_DAYS = 30;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken() {
  return `${crypto.randomUUID()}-${crypto.randomBytes(16).toString("hex")}`;
}

export function getSessionExpiryMs() {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}
