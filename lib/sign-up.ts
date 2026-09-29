import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { orm } from "@/src/prisma/db";
import { hasPassed, instantToDb } from "@/lib/datetime";
import { appUrl, sendEmailVerification } from "@/lib/email";
import { SignupRole } from "@/lib/enums";
import { newId } from "@/lib/ids";
import { hashToken, issueToken } from "@/lib/tokens";
import { toFieldErrors, type FormState } from "@/lib/validation";

/*
 * Open sign-up (plans/registration.md, phase 1): anybody can make an account,
 * as a patient or a doctor. An account is a person; it grants nothing clinical
 * on its own. Shared by the web's /signup and the app's API.
 */

/**
 * The privacy notice somebody agrees to at sign-up. Bump it whenever the
 * notice at /privacy changes; the account records which one they agreed to.
 */
export const PRIVACY_NOTICE_VERSION = "2026-09-29";

const VERIFY_DAYS = 3;

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirmPassword: z.string(),
    role: z.enum(SignupRole, { message: "Choose patient or doctor" }),
    // A checkbox sends "on"; the app sends true.
    consent: z.union([z.literal("on"), z.literal(true)], { message: "You need to agree to the privacy notice" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpResult = { ok: true; accountId: string } | ({ ok: false } & FormState);

/** A new account, unverified, and the email that asks them to verify it. */
export async function createAccount(input: Record<string, unknown>): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };
  const { fullName, email, password, role } = parsed.data;

  const taken = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
  if (taken) {
    return {
      ok: false,
      message: "That email already has a Medfave account.",
      fieldErrors: { email: ["Already registered — sign in instead"] },
    };
  }

  const now = instantToDb(new Date());
  const account = await orm.Account.select("id").create({
    id: newId(),
    email,
    passwordHash: await bcrypt.hash(password, 12),
    fullName,
    signupRole: role,
    consentedAt: now,
    consentVersion: PRIVACY_NOTICE_VERSION,
    createdAt: now,
    updatedAt: now,
  });

  await sendVerification(account.id);
  return { ok: true, accountId: account.id };
}

/**
 * Sends a fresh verification link. One live link at a time: a new one
 * replaces the last. Quietly does nothing for an account already verified.
 */
export async function sendVerification(accountId: string) {
  const account = await orm.Account
    .select("id", "email", "fullName", "emailVerifiedAt")
    .where((a) => a.id.eq(accountId))
    .first();
  if (!account || account.emailVerifiedAt) return;

  const now = instantToDb(new Date());
  for (;;) {
    const live = await orm.EmailVerification
      .select("id")
      .where((v) => v.accountId.eq(accountId))
      .where((v) => v.usedAt.isNull())
      .where((v) => v.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.EmailVerification.where((v) => v.id.eq(live.id)).update({ revokedAt: now });
  }

  const { token, hash } = issueToken();
  await orm.EmailVerification.create({
    id: newId(),
    accountId,
    tokenHash: hash,
    expiresAt: instantToDb(new Date(Date.now() + VERIFY_DAYS * 24 * 60 * 60 * 1000)),
    createdAt: now,
  });

  const outcome = await sendEmailVerification({
    to: account.email,
    name: account.fullName,
    link: appUrl(`/verify-email?code=${encodeURIComponent(token)}`),
  });
  if (!outcome.sent && outcome.reason !== "not-configured") {
    console.error(`[email] verification for ${accountId}: ${outcome.reason}`);
  }
}

/** Spends a verification link. Returns the account it verified, or null for any kind of bad link. */
export async function verifyEmail(code: string): Promise<{ accountId: string } | null> {
  if (!code) return null;
  const link = await orm.EmailVerification
    .select("id", "accountId", "expiresAt", "usedAt", "revokedAt")
    .where((v) => v.tokenHash.eq(hashToken(code)))
    .first();
  if (!link || link.usedAt || link.revokedAt || hasPassed(link.expiresAt)) return null;

  const now = instantToDb(new Date());
  await orm.EmailVerification.where((v) => v.id.eq(link.id)).update({ usedAt: now });
  await orm.Account.where((a) => a.id.eq(link.accountId)).update({ emailVerifiedAt: now, updatedAt: now });
  return { accountId: link.accountId };
}
