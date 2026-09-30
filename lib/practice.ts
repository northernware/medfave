import "server-only";
import { z } from "zod";
import { db, orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { appUrl, sendVerificationOutcome, sendVerificationRequest } from "@/lib/email";
import { newId } from "@/lib/ids";
import { toFieldErrors, type FormState } from "@/lib/validation";

/*
 * A doctor sets up their own practice, and Medfave checks their license
 * (plans/registration.md, phase 2). Until a platform admin verifies them, the
 * clinic can be set up (hours, details) but nothing clinical opens: no
 * patients, bookings or staff. Shared by the web and, later, the app.
 */

/** A PRC registration number: seven digits, leading zeros included, as on the ID card. */
const LICENSE = /^\d{7}$/;

/** Where an admin checks a license by hand. The PRC has no API. */
export const PRC_LOOKUP_URL = "https://online1.prc.gov.ph/Verification";

const doctorFields = {
  licenseName: z.string().trim().min(2, "Enter your name as it is on your PRC license").max(120),
  specialty: z.string().trim().max(80).optional().transform((v) => v || null),
  licenseNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(LICENSE, "Seven digits, as on your PRC ID — include any leading zeros")),
};

export const practiceSchema = z.object({
  ...doctorFields,
  clinicName: z.string().trim().min(2, "Enter your clinic's name").max(120),
  address: z.string().trim().min(5, "Enter the clinic's address").max(300),
  contactNumber: z.string().trim().min(7, "Enter a phone number patients can call").max(40),
});

export const resubmitSchema = z.object(doctorFields);

/** The opening week a new clinic starts with; all of it editable in Schedule. */
const DEFAULT_HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, openMinute: 9 * 60, closeMinute: 17 * 60 })),
  { weekday: 6, openMinute: 9 * 60, closeMinute: 12 * 60 },
];
const DEFAULT_LUNCH = { startMinute: 12 * 60, endMinute: 13 * 60, label: "Lunch" };

/** Words of a name, for comparing: no titles, punctuation or case. */
function nameWords(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(dr|dra|md|jr|sr|ii|iii|iv)\b\.?/g, " ")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);
}

/**
 * Whether two names plausibly belong to one person: every word of the shorter
 * appears in the longer, so "Maria Santos" matches "Maria Luisa Santos".
 */
export function namesMatch(a: string, b: string) {
  const [x, y] = [nameWords(a), nameWords(b)];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length > 0 && short.every((w) => long.includes(w));
}

/** The automatic checks, as the admin queue shows them beside the doctor. */
export function automaticChecks(d: { emailVerified: boolean; licenseNumber: string | null; licenseName: string; accountName: string }) {
  return [
    { label: "Email confirmed", ok: d.emailVerified },
    { label: "License number is in the PRC format", ok: LICENSE.test(d.licenseNumber ?? "") },
    { label: "Name on the license matches the account", ok: namesMatch(d.licenseName, d.accountName) },
  ];
}

export type PracticeResult = { ok: true; clinicId: string } | ({ ok: false } & FormState);

/**
 * A doctor's first clinic: the clinic, their clinician profile (pending), their
 * membership, and a starting week. The email must be confirmed first — it is
 * one of the checks, and the one they can fix themselves in a minute.
 */
export async function createPractice(accountId: string, input: Record<string, unknown>): Promise<PracticeResult> {
  const account = await orm.Account
    .select("id", "emailVerifiedAt")
    .include("doctorProfile", (d) => d.select("id"))
    .include("memberships", (m) => m.select("id"))
    .where((a) => a.id.eq(accountId))
    .first();
  if (!account) return { ok: false, message: "Sign in again." };
  if (account.doctorProfile || account.memberships.length > 0) {
    return { ok: false, message: "You already have a clinic on Medfave." };
  }
  if (!account.emailVerifiedAt) {
    return { ok: false, message: "Confirm your email first — use the link we sent you — then send this again." };
  }

  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };
  const p = parsed.data;

  const now = instantToDb(new Date());
  const clinicId = newId();
  const doctorId = newId();
  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    await t.Clinic.create({
      id: clinicId,
      name: p.clinicName,
      address: p.address,
      contactNumber: p.contactNumber,
      createdAt: now,
      updatedAt: now,
    });
    await t.Doctor.create({
      id: doctorId,
      clinicId,
      accountId,
      fullName: p.licenseName,
      specialty: p.specialty,
      licenseNumber: p.licenseNumber,
      verificationStatus: "PENDING",
      verificationSubmittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await t.ClinicMember.create({ id: newId(), clinicId, accountId, role: "DOCTOR", createdAt: now, updatedAt: now });
    // The clinic's own week and the doctor's start the same; both editable.
    for (const h of DEFAULT_HOURS) await t.ClinicOpeningHours.create({ id: newId(), clinicId, ...h });
    for (const h of DEFAULT_HOURS) await t.ClinicHours.create({ id: newId(), doctorId, ...h });
    await t.ClinicBreak.create({ id: newId(), doctorId, weekday: null, ...DEFAULT_LUNCH });
  });

  await notifyAdmins({ doctorName: p.licenseName, clinicName: p.clinicName, licenseNumber: p.licenseNumber });
  return { ok: true, clinicId };
}

/** A declined doctor fixes their details and asks again. */
export async function resubmitPractice(doctorId: string, input: Record<string, unknown>): Promise<FormState> {
  const parsed = resubmitSchema.safeParse(input);
  if (!parsed.success) return toFieldErrors(parsed.error);

  const doctor = await orm.Doctor
    .select("id", "verificationStatus")
    .include("clinic", (c) => c.select("name"))
    .where((d) => d.id.eq(doctorId))
    .first();
  if (!doctor || doctor.verificationStatus !== "DECLINED") return { message: "There's nothing to send again." };

  const now = instantToDb(new Date());
  await orm.Doctor.where((d) => d.id.eq(doctorId)).update({
    fullName: parsed.data.licenseName,
    specialty: parsed.data.specialty,
    licenseNumber: parsed.data.licenseNumber,
    verificationStatus: "PENDING",
    verificationSubmittedAt: now,
    declineReason: null,
    updatedAt: now,
  });
  await notifyAdmins({
    doctorName: parsed.data.licenseName,
    clinicName: doctor.clinic?.name ?? "",
    licenseNumber: parsed.data.licenseNumber,
  });
  return { ok: true, message: "Sent. We'll email you when it's checked." };
}

async function notifyAdmins(d: { doctorName: string; clinicName: string; licenseNumber: string }) {
  const admins = await orm.Account.select("email").where((a) => a.platformAdmin.eq(true)).all();
  for (const admin of admins) {
    await sendVerificationRequest({ to: admin.email, ...d, link: appUrl("/admin/verify") });
  }
}

/** A platform admin's decision. Declining needs a reason the doctor can act on. */
export async function decideVerification(
  adminId: string,
  doctorId: string,
  decision: { verified: true } | { verified: false; reason: string },
): Promise<FormState> {
  if (!decision.verified && decision.reason.trim().length < 5) {
    return { message: "Say why, so the doctor knows what to fix.", fieldErrors: { reason: ["Required"] } };
  }
  const doctor = await orm.Doctor
    .select("id", "fullName", "verificationStatus")
    .include("account", (a) => a.select("email", "fullName"))
    .where((d) => d.id.eq(doctorId))
    .first();
  if (!doctor || doctor.verificationStatus !== "PENDING") return { message: "That doctor isn't waiting any more." };

  const now = instantToDb(new Date());
  await orm.Doctor.where((d) => d.id.eq(doctorId)).update({
    verificationStatus: decision.verified ? "VERIFIED" : "DECLINED",
    verifiedAt: decision.verified ? now : null,
    verifiedById: adminId,
    declineReason: decision.verified ? null : decision.reason.trim(),
    updatedAt: now,
  });

  if (doctor.account) {
    await sendVerificationOutcome({
      to: doctor.account.email,
      name: doctor.account.fullName,
      verified: decision.verified,
      reason: decision.verified ? undefined : decision.reason.trim(),
      link: appUrl(decision.verified ? "/dashboard" : "/manage"),
    });
  }
  return { ok: true, message: decision.verified ? `${doctor.fullName} is verified.` : `${doctor.fullName} was declined.` };
}
