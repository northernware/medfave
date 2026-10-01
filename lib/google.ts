import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  Google,
  decodeIdToken,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { z } from "zod";
import { withFullName } from "@/lib/names";
import { db, orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { appUrl } from "@/lib/email";
import { SignupRole } from "@/lib/enums";
import { newId } from "@/lib/ids";
import { openClaims, sealClaims } from "@/lib/session";
import { PRIVACY_NOTICE_VERSION } from "@/lib/sign-up";
import { toFieldErrors, type FormState } from "@/lib/validation";

/*
 * "Continue with Google" (plans/registration.md, phase 1b).
 *
 * Medfave does the OAuth itself, for the web and for the app: the app opens
 * this same flow in a browser session and is handed back a one-time code. A
 * Google sign-in finds its account by the Google id already linked, or else by
 * the verified email. Nobody gets a second account for the same address, and
 * a new person still chooses patient or doctor and agrees to the privacy
 * notice before an account exists.
 */

export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";
const FLOW_COOKIE = "mf_google_flow";
const PENDING_COOKIE = "mf_google_pending";
const FLOW_AUDIENCE = "medfave-google-flow";
const PENDING_AUDIENCE = "medfave-google-pending";
const HANDOFF_AUDIENCE = "medfave-app-handoff";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function client() {
  return new Google(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, appUrl(GOOGLE_CALLBACK_PATH));
}

/** Where to send the app afterwards, and the PKCE challenge only the app can answer. */
export type AppReturn = { returnTo: string; challenge: string };

/**
 * Only the app's own link scheme may receive a code. In development, Expo Go's
 * `exp://` links and a localhost web build are allowed too. Anything else would
 * hand somebody's sign-in to whatever page asked for it.
 */
export function appReturn(returnTo: string | null, challenge: string | null): AppReturn | null {
  if (!returnTo || !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return null;
  let url: URL;
  try {
    url = new URL(returnTo);
  } catch {
    return null;
  }
  const dev = process.env.NODE_ENV !== "production";
  const allowed =
    url.protocol === "medfave:" ||
    (dev && (url.protocol === "exp:" || url.protocol === "exps:")) ||
    (dev && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"));
  return allowed ? { returnTo, challenge } : null;
}

/** Back to the app with `params` (a code, or an error). */
export function appReturnUrl(app: AppReturn, params: Record<string, string>) {
  const url = new URL(app.returnTo);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

type Flow = { state: string; verifier: string; app: AppReturn | null; as: SignupRole | null };

/** The Google URL to send the browser to, with the state kept in a short-lived cookie. */
export async function startGoogle(options: { app: AppReturn | null; as: SignupRole | null }) {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client().createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  // Always show the account chooser: on a shared family phone, silently
  // reusing whoever was signed in to Google last is the wrong default.
  url.searchParams.set("prompt", "select_account");

  const flow: Flow = { state, verifier, ...options };
  (await cookies()).set(FLOW_COOKIE, await sealClaims({ flow }, FLOW_AUDIENCE, 10 * 60), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/auth/google",
  });
  return url;
}

export type GoogleOutcome =
  | { kind: "signed-in"; accountId: string; app: AppReturn | null }
  | { kind: "new"; app: AppReturn | null }
  | { kind: "error"; reason: "cancelled" | "unverified" | "failed"; app: AppReturn | null };

/** Google's redirect back: checks the state, trades the code, and finds (or doesn't find) the account. */
export async function finishGoogle(params: URLSearchParams): Promise<GoogleOutcome> {
  const store = await cookies();
  const claims = await openClaims(store.get(FLOW_COOKIE)?.value, FLOW_AUDIENCE);
  store.delete({ name: FLOW_COOKIE, path: "/auth/google" });
  const flow = (claims?.flow ?? null) as Flow | null;
  const app = flow?.app ?? null;

  if (params.get("error")) return { kind: "error", reason: "cancelled", app };
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return { kind: "error", reason: "failed", app };

  let profile: { subject: string; email: string; emailVerified: boolean; name: string };
  try {
    const tokens = await client().validateAuthorizationCode(code, flow.verifier);
    // Straight from Google's token endpoint over TLS, in exchange for our
    // secret, so the ID token needs no signature check of its own (OIDC 3.1.3.7).
    const id = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
    profile = {
      subject: String(id.sub),
      email: String(id.email ?? "").toLowerCase(),
      emailVerified: id.email_verified === true,
      name: typeof id.name === "string" ? id.name : "",
    };
  } catch (cause) {
    console.error("[google] code exchange failed:", cause);
    return { kind: "error", reason: "failed", app };
  }

  const linked = await orm.AccountIdentity
    .select("accountId")
    .where((i) => i.provider.eq("GOOGLE"))
    .where((i) => i.subject.eq(profile.subject))
    .first();
  if (linked) return { kind: "signed-in", accountId: linked.accountId, app };

  // Everything past here trusts the email, so Google must have checked it.
  if (!profile.email || !profile.emailVerified) return { kind: "error", reason: "unverified", app };

  const existing = await orm.Account.select("id").where((a) => a.email.eq(profile.email)).first();
  if (existing) {
    await linkGoogle(existing.id, profile.subject, profile.email);
    return { kind: "signed-in", accountId: existing.id, app };
  }

  // A new person: they still choose patient or doctor, and consent, first.
  const pending = { subject: profile.subject, email: profile.email, name: profile.name, app, as: flow.as };
  store.set(PENDING_COOKIE, await sealClaims({ pending }, PENDING_AUDIENCE, 30 * 60), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });
  return { kind: "new", app };
}

/**
 * Links a Google id to an existing account with the same, Google-verified,
 * email.
 *
 * If that account never confirmed its email, whoever made it never proved the
 * inbox was theirs; Google just proved it is this person's. So their password
 * is removed and their sessions ended: somebody who signed up with another
 * person's address in advance doesn't keep a way in. The owner can set a
 * password with "Forgot password".
 */
async function linkGoogle(accountId: string, subject: string, email: string) {
  const now = instantToDb(new Date());
  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    const account = await t.Account.select("emailVerifiedAt").where((a) => a.id.eq(accountId)).first();
    if (account && !account.emailVerifiedAt) {
      await t.Account.where((a) => a.id.eq(accountId)).update({
        emailVerifiedAt: now,
        passwordHash: null,
        sessionsValidFrom: now,
        updatedAt: now,
      });
    }
    await t.AccountIdentity.create({ id: newId(), accountId, provider: "GOOGLE", subject, email, createdAt: now });
  });
}

export type PendingGoogle = {
  subject: string;
  email: string;
  name: string;
  app: AppReturn | null;
  as: SignupRole | null;
};

/** The Google sign-up waiting on its role and consent, if there is one. */
export async function pendingGoogle(): Promise<PendingGoogle | null> {
  const claims = await openClaims((await cookies()).get(PENDING_COOKIE)?.value, PENDING_AUDIENCE);
  return (claims?.pending ?? null) as PendingGoogle | null;
}

const finishSchema = z.preprocess(
  withFullName,
  z.object({
    fullName: z.string().trim().min(2, "Enter your first and last name").max(120),
    role: z.enum(SignupRole, { message: "Choose patient or doctor" }),
    consent: z.literal("on", { message: "You need to agree to the privacy notice" }),
  }),
);

export type GoogleSignUpResult =
  | { ok: true; accountId: string; app: AppReturn | null }
  | ({ ok: false } & FormState);

/** The new account, from the pending Google sign-in plus what the person chose. Verified: Google checked the email. */
export async function completeGoogleSignUp(input: Record<string, unknown>): Promise<GoogleSignUpResult> {
  const pending = await pendingGoogle();
  if (!pending) return { ok: false, message: "That Google sign-in has expired. Start again." };
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };

  const now = instantToDb(new Date());
  // Signed up another way in the meantime: link rather than duplicate.
  const existing = await orm.Account.select("id").where((a) => a.email.eq(pending.email)).first();
  let accountId = existing?.id;
  if (existing) {
    await linkGoogle(existing.id, pending.subject, pending.email);
  } else {
    accountId = await db.transaction(async (tx) => {
      const t = tx.orm.public;
      const account = await t.Account.select("id").create({
        id: newId(),
        email: pending.email,
        fullName: parsed.data.fullName,
        emailVerifiedAt: now,
        signupRole: parsed.data.role,
        consentedAt: now,
        consentVersion: PRIVACY_NOTICE_VERSION,
        createdAt: now,
        updatedAt: now,
      });
      await t.AccountIdentity.create({
        id: newId(),
        accountId: account.id,
        provider: "GOOGLE",
        subject: pending.subject,
        email: pending.email,
        createdAt: now,
      });
      return account.id;
    });
  }

  (await cookies()).delete(PENDING_COOKIE);
  return { ok: true, accountId: accountId!, app: pending.app };
}

/**
 * The one-time code the app gets back instead of a token. Good for two
 * minutes, and only with the verifier behind the challenge the app sent at the
 * start, so a code caught on its way back is no use to anyone else.
 */
export async function issueHandoff(accountId: string, app: AppReturn) {
  return sealClaims({ accountId, challenge: app.challenge }, HANDOFF_AUDIENCE, 2 * 60);
}

export async function redeemHandoff(code: string, verifier: string): Promise<string | null> {
  const claims = await openClaims(code, HANDOFF_AUDIENCE);
  if (!claims || typeof claims.accountId !== "string" || typeof claims.challenge !== "string") return null;
  if (verifier.length < 43 || createHash("sha256").update(verifier).digest("base64url") !== claims.challenge) return null;
  return claims.accountId;
}
