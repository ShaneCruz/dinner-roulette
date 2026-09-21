import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

/** Signs a short value so a cookie can't be edited to impersonate someone. */
export function sign(value: string): string {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function unsign(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signed);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return value;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(pin, salt, 32).toString("base64url");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(pin, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
