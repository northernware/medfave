import "server-only";
import { orm } from "@/src/prisma/db";
import type { CurrentPatient } from "@/lib/auth";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { hit, TOO_MANY } from "@/lib/rate-limit";

/*
 * A patient deciding who looks after their own records: seeing who can, and,
 * once they're an adult, adding or removing them. Their own say is consent
 * enough — no desk needed, as there is for a child (`CareLink`). Shared by
 * the portal and the app's API.
 */

const ADULT = 18;

/** Whole years since a YYYY-MM-DD birthday, today. */
function yearsOld(dateOfBirth: string, today = new Date()) {
  const [y, m, d] = dateOfBirth.slice(0, 10).split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export type Carer = { id: string; name: string; email: string; since: string };

/**
 * Who looks after this chart, for the patient whose own chart it is. Null when
 * the chart being shown is somebody else's (a caregiver sees nothing here).
 * `canManage`: an adult decides for themselves; a child's carers are the desk's to change.
 */
export async function carersOf(me: CurrentPatient): Promise<{ carers: Carer[]; canManage: boolean } | null> {
  if (!me.self) return null;
  const [patient, links] = await Promise.all([
    orm.Patient.select("dateOfBirth").where((p) => p.id.eq(me.patientId)).first(),
    orm.CareLink
      .select("id", "createdAt")
      .include("account", (a) => a.select("fullName", "email"))
      .where((l) => l.patientId.eq(me.patientId))
      .where((l) => l.revokedAt.isNull())
      .orderBy((l) => l.createdAt.asc())
      .all(),
  ]);
  return {
    carers: links.map((l) => ({ id: l.id, name: l.account.fullName, email: l.account.email, since: String(l.createdAt) })),
    canManage: Boolean(patient && yearsOld(String(patient.dateOfBirth)) >= ADULT),
  };
}

export type CareResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const NOT_YOURS: CareResult = { ok: false, message: "Only you can change who looks after your own records." };
const NOT_ADULT: CareResult = {
  ok: false,
  message: "The clinic manages who looks after a child's records. Ask the desk.",
};

/** "Let Ana look after me": an adult adds somebody with a Medfave login, by its email. */
export async function grantCare(me: CurrentPatient, rawEmail: unknown): Promise<CareResult> {
  const state = await carersOf(me);
  if (!state) return NOT_YOURS;
  if (!state.canManage) return NOT_ADULT;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email.includes("@")) return { ok: false, message: "Enter their email.", fieldErrors: { email: ["Required"] } };
  // Counted, since an answer says whether an email has a Medfave account.
  if (!(await hit(`care-grant:${me.accountId}`, { limit: 10, windowSeconds: 60 * 60 }))) return { ok: false, message: TOO_MANY };

  const carer = await orm.Account.select("id").where((a) => a.email.eq(email)).first();
  if (!carer) {
    return {
      ok: false,
      message: "Nobody uses Medfave with that email yet. Ask them to sign up, then add them here.",
      fieldErrors: { email: ["No Medfave account"] },
    };
  }
  if (carer.id === me.accountId) return { ok: false, message: "That's you.", fieldErrors: { email: ["That's your own email"] } };

  const already = await orm.CareLink
    .select("id")
    .where((l) => l.accountId.eq(carer.id))
    .where((l) => l.patientId.eq(me.patientId))
    .where((l) => l.revokedAt.isNull())
    .first();
  if (!already) {
    await orm.CareLink.create({
      id: newId(),
      clinicId: me.clinicId,
      patientId: me.patientId,
      accountId: carer.id,
      // Granted by the patient themselves, not by staff.
      grantedById: me.accountId,
      createdAt: instantToDb(new Date()),
    });
  }
  return { ok: true };
}

/** An adult ends somebody's access to their records. Kept as revoked, so it stays answerable. */
export async function removeCare(me: CurrentPatient, linkId: string): Promise<CareResult> {
  const state = await carersOf(me);
  if (!state) return NOT_YOURS;
  if (!state.canManage) return NOT_ADULT;
  if (!state.carers.some((c) => c.id === linkId)) return { ok: false, message: "Not found." };
  await orm.CareLink.where((l) => l.id.eq(linkId)).update({ revokedAt: instantToDb(new Date()), revokedById: me.accountId });
  return { ok: true };
}

/** A caregiver stepping back from somebody's records they look after. */
export async function stopCaring(me: CurrentPatient): Promise<CareResult> {
  if (me.self) return { ok: false, message: "These are your own records." };
  const link = await orm.CareLink
    .select("id")
    .where((l) => l.accountId.eq(me.accountId))
    .where((l) => l.patientId.eq(me.patientId))
    .where((l) => l.revokedAt.isNull())
    .first();
  if (!link) return { ok: false, message: "Not found." };
  await orm.CareLink.where((l) => l.id.eq(link.id)).update({ revokedAt: instantToDb(new Date()), revokedById: me.accountId });
  return { ok: true };
}

/** A caregiver stepping back from one person's chart, from their family list. */
export async function stopCaringFor(accountId: string, patientId: string): Promise<CareResult> {
  const link = await orm.CareLink
    .select("id")
    .where((l) => l.accountId.eq(accountId))
    .where((l) => l.patientId.eq(patientId))
    .where((l) => l.revokedAt.isNull())
    .first();
  if (!link) return { ok: false, message: "Not found." };
  await orm.CareLink.where((l) => l.id.eq(link.id)).update({ revokedAt: instantToDb(new Date()), revokedById: accountId });
  return { ok: true };
}

/**
 * The desk linking a caregiver directly — somebody it has identified who
 * already uses Medfave (a parent in the same household, say). No code to hand
 * over: the person appears in their family list at once. `who` is their
 * account id, or the email their Medfave login uses.
 */
export async function grantCareByStaff(
  staff: { accountId: string; clinicId: string },
  patientId: string,
  who: { accountId?: string; email?: string },
): Promise<CareResult & { name?: string }> {
  const patient = await orm.Patient
    .select("id", "accountId", "archivedAt")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient || patient.archivedAt) return { ok: false, message: "That chart can't be changed." };

  const email = who.email?.trim().toLowerCase();
  const carer = who.accountId
    ? await orm.Account.select("id", "fullName").where((a) => a.id.eq(who.accountId!)).first()
    : email
      ? await orm.Account.select("id", "fullName").where((a) => a.email.eq(email)).first()
      : null;
  if (!carer) return { ok: false, message: "Nobody uses Medfave with that email. Give them a code instead." };
  if (carer.id === patient.accountId) return { ok: false, message: "That's the patient's own login." };

  const already = await orm.CareLink
    .select("id")
    .where((l) => l.accountId.eq(carer.id))
    .where((l) => l.patientId.eq(patientId))
    .where((l) => l.revokedAt.isNull())
    .first();
  if (!already) {
    await orm.CareLink.create({
      id: newId(),
      clinicId: staff.clinicId,
      patientId,
      accountId: carer.id,
      grantedById: staff.accountId,
      createdAt: instantToDb(new Date()),
    });
  }
  return { ok: true, name: carer.fullName };
}
