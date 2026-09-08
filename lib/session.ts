import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "medikonek_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // a long clinic day, then re-auth

function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set — see .env.example");
  return new TextEncoder().encode(secret);
}

/**
 * The cookie says who is signed in and nothing else.
 *
 * Not what they may do: roles and clinic membership are read from the database
 * on every request. A permission baked into a token keeps working for as long
 * as the token lives, which means revoking somebody's access would not take
 * effect until they happened to sign out.
 */
export async function createSession(accountId: string) {
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  const token = await new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(signingKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function readSession(): Promise<{ accountId: string } | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    return typeof payload.accountId === "string" ? { accountId: payload.accountId } : null;
  } catch {
    // Expired or tampered with — treat as signed out.
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}
