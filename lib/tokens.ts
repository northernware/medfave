import "server-only";
import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A code somebody is handed once, and its hash, which is all that is stored.
 *
 * An invitation or an activation code is a credential: it is the only thing
 * standing between a stranger and somebody's chart. Keeping only the hash means
 * a copy of the table is not a set of working keys, which matters because the
 * people who read a database backup are not the people the code was given to.
 *
 * Grouped in fours because these get read down a phone line and typed in by
 * hand, and an unbroken string of twenty characters is read wrong.
 */
export function issueToken(): { token: string; hash: string } {
  const raw = randomBytes(10).toString("base64url").replace(/[-_]/g, "").toUpperCase();
  const padded = (raw + randomBytes(6).toString("hex").toUpperCase()).slice(0, 16);
  const token = padded.match(/.{1,4}/g)!.join("-");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(normaliseToken(token)).digest("hex");
}

/** Typed by a person, so spacing and case are not held against them. */
export function normaliseToken(token: string) {
  return token.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Compares two hashes without letting the time taken say how much matched.
 *
 * Overkill against a hash of a random 16-character code, and cheap enough that
 * the argument for leaving it out is not worth making.
 */
export function tokenMatches(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * A 6-digit code, to read out at the desk or type on a phone, and its keyed
 * hash. Six digits are only a million possibilities, so it is safe only
 * because it lives minutes, not days, and wrong tries are rate-limited; and it
 * is hashed with a server key, so a copy of the table can't be reversed by
 * trying all million.
 */
export function issuePin(): { pin: string; hash: string } {
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return { pin, hash: hashPin(pin) };
}

export function hashPin(pin: string) {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is not set — see .env.example");
  return createHmac("sha256", key).update(`pin:${pin}`).digest("hex");
}

/** Six digits, however they were spaced or dashed, or null if it isn't a PIN. */
export function asPin(code: string) {
  const digits = code.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}
