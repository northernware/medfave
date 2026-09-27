"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, orm } from "@/src/prisma/db";
import { hasPassed, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hashToken, issueToken, normaliseToken } from "@/lib/tokens";
import { appUrl, sendPasswordReset } from "@/lib/email";
import { createSession, destroySession } from "@/lib/session";
import { getViewer, homeFor } from "@/lib/auth";
import {
  activationSchema,
  forgotPasswordSchema,
  inviteAcceptSchema,
  loginSchema,
  passwordResetSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

// Compared against when no account matches, so a wrong email and a wrong
// password take the same amount of time to reject.
const DECOY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3jGZ5VZ0rJ8vJ8gXqU9O0F5nJ0lK7Zu";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const account = await orm.Account
    .select("id", "passwordHash")
    .where((a) => a.email.eq(parsed.data.email))
    .first();

  const matches = await bcrypt.compare(parsed.data.password, account?.passwordHash ?? DECOY_HASH);
  if (!account || !matches) {
    // Deliberately vague: never confirm which half was wrong.
    return { message: "Email or password is incorrect." };
  }

  await createSession(account.id);

  // Each role has its own front door; landing on somebody else's and being
  // bounced is a worse first impression than arriving in the right place.
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
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
export async function activatePatientAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = activationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { code, email, password } = parsed.data;
  const activation = await orm.PatientActivation
    .select("id", "patientId", "clinicId", "expiresAt", "usedAt", "revokedAt")
    .include("patient", (p) => p.select("id", "accountId"))
    .where((a) => a.tokenHash.eq(hashToken(code)))
    .first();

  // One message for every way a code can fail. Saying which would let somebody
  // sort real codes from invented ones.
  const refuse: FormState = {
    message: "That activation code is not valid. Ask the clinic for a new one.",
    fieldErrors: { code: ["Not valid"] },
  };
  if (!activation || activation.usedAt || activation.revokedAt) return refuse;
  if (hasPassed(activation.expiresAt)) return refuse;
  if (activation.patient.accountId) return refuse;

  const taken = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
  if (taken) {
    return {
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

  await createSession(accountId);
  redirect("/portal");
}

/**
 * Turns a staff invitation into a member of that clinic.
 *
 * Staff exist only because an existing member asked for them. There is no path
 * from the public sign-up page to any of this, which is the point: a role is
 * granted by somebody who already holds one.
 */
export async function acceptStaffInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = inviteAcceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { code, password, fullName } = parsed.data;
  const invite = await orm.StaffInvite
    .select("id", "clinicId", "email", "role", "expiresAt", "acceptedAt", "revokedAt")
    .where((i) => i.tokenHash.eq(hashToken(code)))
    .first();

  const refuse: FormState = {
    message: "That invitation is not valid. Ask the clinic to send another.",
    fieldErrors: { code: ["Not valid"] },
  };
  if (!invite || invite.acceptedAt || invite.revokedAt) return refuse;
  if (hasPassed(invite.expiresAt)) return refuse;

  // An invitation names the address it was sent to; it is not a blank pass for
  // whoever holds the code to sign up under any address they like.
  const email = invite.email;
  const existing = await orm.Account.select("id").where((a) => a.email.eq(email)).first();

  const now = instantToDb(new Date());
  const accountId = await db.transaction(async (tx) => {
    const t = tx.orm.public;

    const id =
      existing?.id ??
      (
        await t.Account.select("id").create({
          id: newId(),
          email,
          passwordHash: await bcrypt.hash(password, 12),
          fullName,
          createdAt: now,
          updatedAt: now,
        })
      ).id;

    const already = await t.ClinicMember
      .select("id")
      .where((m) => m.clinicId.eq(invite.clinicId))
      .where((m) => m.accountId.eq(id))
      .first();
    if (!already) {
      await t.ClinicMember.create({
        id: newId(),
        clinicId: invite.clinicId,
        accountId: id,
        // The role comes from the invitation, never from the form.
        role: invite.role,
        createdAt: now,
        updatedAt: now,
      });
    }

    await t.StaffInvite.where((i) => i.id.eq(invite.id)).update({
      acceptedAt: now,
      acceptedById: id,
    });

    return id;
  });

  await createSession(accountId);
  // Straight to the door that belongs to the role the invitation granted.
  redirect(invite.role === "SECRETARY" ? "/desk" : invite.role === "ADMIN" ? "/manage" : "/");
}

/** Reads an invitation for the acceptance page, without spending it. */
export async function peekInvite(code: string) {
  const invite = await orm.StaffInvite
    .select("email", "role", "expiresAt", "acceptedAt", "revokedAt")
    .include("clinic", (c) => c.select("name"))
    .where((i) => i.tokenHash.eq(hashToken(normaliseToken(code))))
    .first();
  if (!invite || invite.acceptedAt || invite.revokedAt) return null;
  if (hasPassed(invite.expiresAt)) return null;
  return { email: invite.email, role: invite.role, clinicName: invite.clinic.name };
}

/** Long enough to go and find the email, short enough that a forwarded one is stale. */
const RESET_MINUTES = 60;

/**
 * How long the forgot-password form takes, whoever asked.
 *
 * Both branches are padded to the same budget. Without it, "we found you, wrote
 * a row and sent mail" and "we did nothing" are a stopwatch apart, and that
 * difference answers the exact question the identical wording refuses to.
 */
const RESET_BUDGET_MS = 1500;

async function pad<T>(startedAt: number, value: T): Promise<T> {
  const left = RESET_BUDGET_MS - (Date.now() - startedAt);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
  return value;
}

/**
 * Sends somebody a way back in, without saying whether there was anybody to send it to.
 *
 * The confirmation is the same for an address that has an account and one that
 * does not, because this form is reachable by anyone and a clinic's patient
 * list is not public. Everything that distinguishes the two cases — the
 * wording, the field errors, the time taken — is deliberately flattened.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const startedAt = Date.now();
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { email } = parsed.data;
  const confirmed: FormState = {
    ok: true,
    message:
      `If ${email} has a medfave account, a link is on its way. It expires in an hour. ` +
      `Check the spam folder if it does not appear.`,
  };

  const account = await orm.Account
    .select("id", "fullName")
    .where((a) => a.email.eq(email))
    .first();
  if (!account) return pad(startedAt, confirmed);

  const now = instantToDb(new Date());

  // One live link at a time: asking again replaces the last one rather than
  // leaving a trail of working keys in somebody's inbox.
  for (;;) {
    const live = await orm.PasswordReset
      .select("id")
      .where((r) => r.accountId.eq(account.id))
      .where((r) => r.usedAt.isNull())
      .where((r) => r.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.PasswordReset.where((r) => r.id.eq(live.id)).update({ revokedAt: now });
  }

  const { token, hash } = issueToken();
  await orm.PasswordReset.create({
    id: newId(),
    accountId: account.id,
    tokenHash: hash,
    expiresAt: instantToDb(new Date(Date.now() + RESET_MINUTES * 60 * 1000)),
    createdAt: now,
  });

  // The outcome is not reported back: whether mail was configured or the
  // provider accepted it is a fact about this clinic's setup, and saying it
  // here would say that the address exists.
  await sendPasswordReset({
    to: email,
    name: account.fullName,
    link: appUrl(`/reset?code=${encodeURIComponent(token)}`),
    code: token,
  });

  return pad(startedAt, confirmed);
}

/**
 * Spends a reset code on a new password.
 *
 * The code is the whole of the evidence, so it is single-use, hashed at rest
 * and short-lived. On success `sessionsValidFrom` moves to now, which is what
 * makes this a recovery rather than a second key: whoever was already signed in
 * as this account — including whoever locked the owner out — is signed out.
 */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { code, password } = parsed.data;
  const reset = await orm.PasswordReset
    .select("id", "accountId", "expiresAt", "usedAt", "revokedAt")
    .where((r) => r.tokenHash.eq(hashToken(code)))
    .first();

  // One message for every way a code can fail, for the same reason as the form
  // that issued it: used, expired, revoked and invented must look alike.
  const refuse: FormState = {
    message: "That reset link is not valid any more. Ask for a new one.",
    fieldErrors: { code: ["Not valid"] },
  };
  if (!reset || reset.usedAt || reset.revokedAt) return refuse;
  if (hasPassed(reset.expiresAt)) return refuse;

  const now = instantToDb(new Date());
  const passwordHash = await bcrypt.hash(password, 12);

  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    await t.Account.where((a) => a.id.eq(reset.accountId)).update({
      passwordHash,
      sessionsValidFrom: now,
      updatedAt: now,
    });
    await t.PasswordReset.where((r) => r.id.eq(reset.id)).update({ usedAt: now });
  });

  // No session is created here. Signing in with the new password is the proof
  // that it is the one they meant, and it costs one more form.
  redirect("/login?reset=done");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
