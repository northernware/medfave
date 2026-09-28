import "server-only";
import bcrypt from "bcryptjs";
import { db, orm } from "@/src/prisma/db";
import { hasPassed, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hashToken } from "@/lib/tokens";
import { activationSchema, loginSchema, toFieldErrors, type FormState } from "@/lib/validation";

/*
 * Signing in and activating a patient login, shared by the web forms and the
 * app's API. Each returns the account on success or a FormState to show; what
 * happens next — a cookie and a redirect, or a token in JSON — is the caller's.
 */

export type SignInResult = { ok: true; accountId: string } | ({ ok: false } & FormState);

// Compared against when no account matches, so a wrong email and a wrong
// password take the same amount of time to reject.
const DECOY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3jGZ5VZ0rJ8vJ8gXqU9O0F5nJ0lK7Zu";

export async function checkCredentials(input: Record<string, unknown>): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };

  const account = await orm.Account
    .select("id", "passwordHash")
    .where((a) => a.email.eq(parsed.data.email))
    .first();

  const matches = await bcrypt.compare(parsed.data.password, account?.passwordHash ?? DECOY_HASH);
  if (!account || !matches) {
    // Deliberately vague: never confirm which half was wrong.
    return { ok: false, message: "Email or password is incorrect." };
  }
  return { ok: true, accountId: account.id };
}

/**
 * Turns an activation code into a patient's own login.
 *
 * This is the only public sign-up there is, and all it can ever produce is a
 * patient account tied to the one chart the code names. A name and an email
 * are not evidence of identity, so nothing here matches on them: the clinic
 * identified somebody at the desk, issued a code for their record, and the
 * code is what carries that decision.
 */
export async function activatePatient(input: Record<string, unknown>): Promise<SignInResult> {
  const parsed = activationSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };

  const { code, email, password } = parsed.data;
  const activation = await orm.PatientActivation
    .select("id", "patientId", "clinicId", "expiresAt", "usedAt", "revokedAt")
    .include("patient", (p) => p.select("id", "accountId"))
    .where((a) => a.tokenHash.eq(hashToken(code)))
    .first();

  // One message for every way a code can fail. Saying which would let somebody
  // sort real codes from invented ones.
  const refuse = {
    ok: false as const,
    message: "That activation code is not valid. Ask the clinic for a new one.",
    fieldErrors: { code: ["Not valid"] },
  };
  if (!activation || activation.usedAt || activation.revokedAt) return refuse;
  if (hasPassed(activation.expiresAt)) return refuse;
  if (activation.patient.accountId) return refuse;

  const taken = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
  if (taken) {
    return {
      ok: false,
      message: "That email already has an account.",
      fieldErrors: { email: ["Already registered — sign in instead"] },
    };
  }

  const now = instantToDb(new Date());
  const accountId = await db.transaction(async (tx) => {
    const t = tx.orm.public;

    const account = await t.Account.select("id").create({
      id: newId(),
      email,
      passwordHash: await bcrypt.hash(password, 12),
      fullName: parsed.data.fullName,
      createdAt: now,
      updatedAt: now,
    });

    // The link, and the code spent. No clinic membership is created: being a
    // patient of a clinic is not working there.
    await t.Patient.where((p) => p.id.eq(activation.patientId)).update({
      accountId: account.id,
      updatedAt: now,
    });
    await t.PatientActivation.where((a) => a.id.eq(activation.id)).update({ usedAt: now });

    return account.id;
  });

  return { ok: true, accountId };
}
