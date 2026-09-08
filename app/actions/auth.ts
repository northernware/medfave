"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db, orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hashToken, normaliseToken } from "@/lib/tokens";
import { createSession, destroySession } from "@/lib/session";
import { getViewer, homeFor } from "@/lib/auth";
import { activationSchema, inviteAcceptSchema, loginSchema, toFieldErrors, type FormState } from "@/lib/validation";

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
  if (instantToDb(new Date()) > activation.expiresAt) return refuse;
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
  if (instantToDb(new Date()) > invite.expiresAt) return refuse;

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
  redirect(invite.role === "SECRETARY" ? "/desk" : "/");
}

/** Reads an invitation for the acceptance page, without spending it. */
export async function peekInvite(code: string) {
  const invite = await orm.StaffInvite
    .select("email", "role", "expiresAt", "acceptedAt", "revokedAt")
    .include("clinic", (c) => c.select("name"))
    .where((i) => i.tokenHash.eq(hashToken(normaliseToken(code))))
    .first();
  if (!invite || invite.acceptedAt || invite.revokedAt) return null;
  if (instantToDb(new Date()) > invite.expiresAt) return null;
  return { email: invite.email, role: invite.role, clinicName: invite.clinic.name };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
