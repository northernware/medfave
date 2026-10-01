import "server-only";
import bcrypt from "bcryptjs";
import { db, orm } from "@/src/prisma/db";
import { hasPassed, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hit, hitAll, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { asPin, hashPin, hashToken } from "@/lib/tokens";
import { namePartsOf } from "@/lib/names";
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

export async function checkCredentials(input: Record<string, unknown>, address: string): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };

  const allowed = await hitAll([
    [`sign-in:email:${parsed.data.email}`, LIMITS.signInEmail],
    [`sign-in:address:${address}`, LIMITS.signInAddress],
  ]);
  if (!allowed) return { ok: false, message: TOO_MANY };

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

// One message for every way a code can fail. Saying which would let somebody
// sort real codes from invented ones.
const REFUSE_CODE = {
  ok: false as const,
  message: "That activation code is not valid. Ask the clinic for a new one.",
  fieldErrors: { code: ["Not valid"] },
};

/**
 * An activation code that can still be used: known, unspent, unrevoked,
 * unexpired, its chart unclaimed. Either the long code (from the QR, the link
 * or the email) or the 6-digit one, which also has its own, shorter expiry.
 */
async function liveActivation(code: string) {
  const pin = asPin(code);
  const activation = await orm.PatientActivation
    .select("id", "patientId", "clinicId", "expiresAt", "usedAt", "revokedAt", "pinExpiresAt")
    .include("patient", (p) => p.select("id", "accountId"))
    .where((a) => (pin ? a.pinHash.eq(hashPin(pin)) : a.tokenHash.eq(hashToken(code))))
    .orderBy((a) => a.createdAt.desc())
    .first();
  if (!activation || activation.usedAt || activation.revokedAt) return null;
  if (hasPassed(activation.expiresAt)) return null;
  if (pin && (!activation.pinExpiresAt || hasPassed(activation.pinExpiresAt))) return null;
  if (activation.patient.accountId) return null;
  return activation;
}

export type LinkResult = { ok: true; clinicId: string; clinicName: string } | ({ ok: false } & FormState);

/**
 * "Add a clinic": a signed-in patient redeems another clinic's activation
 * code, and that clinic's chart joins their login.
 *
 * The same test as a first activation — the code is the whole of the identity
 * check, issued by a desk that identified the person — plus one: a login may
 * hold one chart per clinic, so a code from a clinic already linked is refused.
 */
export async function linkPatientActivation(accountId: string, rawCode: unknown): Promise<LinkResult> {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (code.length < 4) return { ok: false, message: "Enter the code the clinic gave you.", fieldErrors: { code: ["Required"] } };
  if (!(await hit(`code:account:${accountId}`, LIMITS.codeAttempts))) return { ok: false, message: TOO_MANY };

  const activation = await liveActivation(code);
  if (!activation) return REFUSE_CODE;

  const already = await orm.Patient
    .select("id")
    .where((p) => p.accountId.eq(accountId))
    .where((p) => p.clinicId.eq(activation.clinicId))
    .first();
  if (already) {
    return {
      ok: false,
      message: "Your account is already linked to this clinic. Ask the desk if you think this code is for someone else.",
      fieldErrors: { code: ["Already linked to this clinic"] },
    };
  }

  const now = instantToDb(new Date());
  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    await t.Patient.where((p) => p.id.eq(activation.patientId)).update({ accountId, updatedAt: now });
    await t.PatientActivation.where((a) => a.id.eq(activation.id)).update({ usedAt: now });
  });

  const clinic = await orm.Clinic.select("name").where((c) => c.id.eq(activation.clinicId)).first();
  return { ok: true, clinicId: activation.clinicId, clinicName: clinic?.name ?? "" };
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
export async function activatePatient(input: Record<string, unknown>, address: string): Promise<SignInResult> {
  const parsed = activationSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };
  if (!(await hit(`code:address:${address}`, LIMITS.codeAttempts))) return { ok: false, message: TOO_MANY };

  const { code, email, password } = parsed.data;
  const activation = await liveActivation(code);
  if (!activation) return REFUSE_CODE;

  const taken = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
  if (taken) {
    // One login, many clinics: somebody who already has Medfave adds this
    // clinic to that login rather than making a second one.
    return {
      ok: false,
      message: "That email already has a Medfave account. Sign in, then add this clinic with the same code.",
      fieldErrors: { email: ["Already registered — sign in and choose “Add a clinic”"] },
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
      ...namePartsOf(parsed.data),
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
