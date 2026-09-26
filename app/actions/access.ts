"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { requireClinicManager, requireStaff } from "@/lib/auth";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { issueToken } from "@/lib/tokens";
import { appUrl, sendPatientActivation, sendStaffInvite } from "@/lib/email";
import type { FormState } from "@/lib/validation";

/** Long enough to hand over and be typed in later; short enough to expire. */
const ACTIVATION_DAYS = 14;
const INVITE_DAYS = 7;

const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * Issues the one-time code that lets a patient connect a login to their chart.
 *
 * Desk work: the person is standing there, and identifying them is exactly
 * what a records desk does. The code is shown once, on the page that asked for
 * it, and only its hash is kept — so it cannot be read back out of the system
 * afterwards, by staff or by anybody who reaches the database.
 */
export async function issuePatientActivation(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;

  const patient = await orm.Patient
    .select("id", "accountId", "firstName", "lastName", "email")
    .include("clinic", (c) => c.select("name"))
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient || patient.accountId) return;

  const now = instantToDb(new Date());

  // Any code already out for this person stops working: one live code at a
  // time means a reissue is a replacement, not an addition.
  for (;;) {
    const live = await orm.PatientActivation
      .select("id")
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.PatientActivation.where((a) => a.id.eq(live.id)).update({ revokedAt: now });
  }

  const { token, hash } = issueToken();
  await orm.PatientActivation.create({
    id: newId(),
    clinicId: staff.clinicId,
    patientId,
    tokenHash: hash,
    issuedById: staff.accountId,
    expiresAt: instantToDb(days(ACTIVATION_DAYS)),
    createdAt: now,
  });

  // Posted as well, when the patient has an address on file and the clinic
  // has mail configured. Never instead: the code is still shown on screen, so
  // a mistyped address or a provider having a bad afternoon does not send
  // somebody home empty-handed.
  let mail: "sent" | "failed" | "no-address" | "off" = "off";
  if (patient.email) {
    const outcome = await sendPatientActivation({
      to: patient.email,
      patientName: `${patient.firstName} ${patient.lastName}`,
      clinicName: patient.clinic?.name ?? staff.clinicName,
      code: token,
      link: appUrl(`/register?code=${encodeURIComponent(token)}`),
    });
    mail = outcome.sent ? "sent" : outcome.reason === "not-configured" ? "off" : "failed";
  } else {
    mail = "no-address";
  }

  revalidatePath(`/desk/patients/${patientId}`);
  // The code travels in the URL exactly once, to be read off the screen.
  redirect(`/desk/patients/${patientId}?code=${encodeURIComponent(token)}&mail=${mail}`);
}

export async function revokePatientActivation(formData: FormData) {
  const staff = await requireStaff();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return;

  const owned = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  for (;;) {
    const live = await orm.PatientActivation
      .select("id")
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.usedAt.isNull())
      .where((a) => a.revokedAt.isNull())
      .first();
    if (!live) break;
    await orm.PatientActivation.where((a) => a.id.eq(live.id)).update({ revokedAt: now });
  }

  revalidatePath(`/desk/patients/${patientId}`);
  redirect(`/desk/patients/${patientId}`);
}

/**
 * Invites somebody to work at the clinic.
 *
 * A manager's decision, not the desk's: staff should not be able to appoint
 * more staff. The role is fixed on the invitation, so accepting it cannot grant
 * anything that was not chosen here.
 *
 * A clinician is not invitable. Somebody who can write in a chart is more than
 * a form field, and an invitation carries no clinician profile to write with.
 * An administrator is, because the invitation names this clinic and nothing
 * else: it appoints somebody to run this practice, not to reach past it.
 */
export async function inviteStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireClinicManager();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawRole = String(formData.get("role") ?? "SECRETARY");
  if (!email || !email.includes("@")) {
    return { message: "Enter the address to send it to.", fieldErrors: { email: ["Not an email address"] } };
  }
  if (rawRole !== "SECRETARY" && rawRole !== "ADMIN") {
    return { message: "Invite a secretary or an administrator.", fieldErrors: { role: ["Not a role"] } };
  }
  const role = rawRole;

  const already = await orm.ClinicMember
    .select("id")
    .include("account", (a) => a.select("email"))
    .where((m) => m.clinicId.eq(manager.clinicId))
    .where((m) => m.account.some((a) => a.email.eq(email)))
    .first();
  if (already) return { message: "That person is already a member of this clinic." };

  const now = instantToDb(new Date());
  const { token, hash } = issueToken();

  await orm.StaffInvite.create({
    id: newId(),
    clinicId: manager.clinicId,
    email,
    role,
    tokenHash: hash,
    invitedById: manager.accountId,
    expiresAt: instantToDb(days(INVITE_DAYS)),
    createdAt: now,
  });

  const outcome = await sendStaffInvite({
    to: email,
    clinicName: manager.clinicName,
    invitedBy: manager.fullName,
    role: role === "ADMIN" ? "administrator" : "secretary",
    code: token,
    link: appUrl(`/invite?code=${encodeURIComponent(token)}`),
  });
  const mail = outcome.sent ? "sent" : outcome.reason === "not-configured" ? "off" : "failed";

  revalidatePath("/manage/staff");
  // Shown on screen either way. Mail is a convenience here, not the record of
  // what was issued.
  redirect(
    `/manage/staff?code=${encodeURIComponent(token)}&to=${encodeURIComponent(email)}&mail=${mail}`,
  );
}

export async function revokeStaffInvite(formData: FormData) {
  const manager = await requireClinicManager();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return;

  const invite = await orm.StaffInvite
    .select("id")
    .where((i) => i.id.eq(inviteId))
    .where((i) => i.clinicId.eq(manager.clinicId))
    .first();
  if (!invite) return;

  await orm.StaffInvite.where((i) => i.id.eq(inviteId)).update({
    revokedAt: instantToDb(new Date()),
  });
  revalidatePath("/manage/staff");
}

/** Removes somebody's standing in this clinic. Their account is left alone. */
export async function removeClinicMember(formData: FormData) {
  const manager = await requireClinicManager();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await orm.ClinicMember
    .select("id", "accountId", "role")
    .where((m) => m.id.eq(memberId))
    .where((m) => m.clinicId.eq(manager.clinicId))
    .first();
  if (!member) return;

  // A clinic that can be left with nobody clinical in it is a clinic whose
  // records nobody can reach.
  if (member.role === "DOCTOR") return;

  // And one left with nobody able to administer it is a clinic nobody can
  // appoint staff to again, including the person who would have to undo this.
  // Counted rather than assumed: whoever is doing this may be the last one, and
  // removing yourself is the easiest way to do it by accident.
  if (member.role === "ADMIN") {
    const members = await orm.ClinicMember
      .select("id", "role")
      .where((m) => m.clinicId.eq(manager.clinicId))
      .all();
    const remaining = members.filter(
      (m) => m.id !== memberId && (m.role === "DOCTOR" || m.role === "ADMIN"),
    );
    if (remaining.length === 0) return;
  }

  await orm.ClinicMember.where((m) => m.id.eq(memberId)).delete();
  revalidatePath("/manage/staff");
}
