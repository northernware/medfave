import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { instantFromDb } from "@/lib/datetime";
import type { ClinicRole } from "@/lib/enums";
import { readSession } from "./session";

/**
 * Who is signed in, and what that lets them reach.
 *
 * Assembled from the database on every request rather than carried in the
 * cookie. Three separate things can be true of one account and none of them
 * imply the others: it may be staff somewhere, it may be a clinician, and it
 * may belong to a patient. Each is checked on its own.
 */
export type Viewer = {
  accountId: string;
  email: string;
  fullName: string;
  /** Staff standing in one clinic. Null for a patient-only account. */
  staff: { clinicId: string; clinicName: string; role: ClinicRole } | null;
  /** The clinician profile, when this account is one. */
  doctorId: string | null;
  /** The chart this login belongs to, when it has been activated against one. */
  patient: { id: string; clinicId: string } | null;
};

/** Cached per request, so a layout and its pages share one lookup. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;

  const account = await orm.Account
    .select("id", "email", "fullName", "sessionsValidFrom")
    .include("memberships", (m) =>
      m.select("clinicId", "role").include("clinic", (c) => c.select("name")),
    )
    .include("doctorProfile", (d) => d.select("id"))
    .include("patientProfile", (p) => p.select("id", "clinicId"))
    .where((a) => a.id.eq(session.accountId))
    .first();
  if (!account) return null;

  // A session older than the account's cut-off is over, whatever the cookie
  // still says. The clock has one second of resolution, so a token issued in
  // the same second as the change is kept — otherwise changing a password
  // would sign out the very browser that changed it.
  if (account.sessionsValidFrom) {
    const validFrom = instantFromDb(account.sessionsValidFrom);
    if (session.issuedAt.getTime() < validFrom.getTime() - 1000) return null;
  }

  // One clinic per account for now. The model allows more, and when it is used
  // the clinic will have to be chosen rather than assumed — this is the single
  // place that would change.
  const membership = account.memberships[0] ?? null;

  return {
    accountId: account.id,
    email: account.email,
    fullName: account.fullName,
    staff: membership
      ? {
          clinicId: membership.clinicId,
          clinicName: membership.clinic.name,
          role: membership.role,
        }
      : null,
    doctorId: account.doctorProfile?.id ?? null,
    patient: account.patientProfile
      ? { id: account.patientProfile.id, clinicId: account.patientProfile.clinicId ?? "" }
      : null,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Where an account belongs when it lands on the wrong door. */
export function homeFor(viewer: Viewer) {
  if (viewer.staff?.role === "SECRETARY") return "/desk";
  // An administrator runs the clinic without practising in it, so the clinical
  // section is not theirs. Sending them to "/" was an infinite redirect: the
  // clinical gate bounced them straight back here.
  if (viewer.staff?.role === "ADMIN") return "/manage";
  if (viewer.staff) return "/";
  if (viewer.patient) return "/portal";
  return "/no-access";
}

export type CurrentDoctor = {
  /** The clinician profile's id — what authorship on a note points at. */
  id: string;
  accountId: string;
  clinicId: string;
  clinicName: string | null;
  email: string;
  fullName: string;
  specialty: string | null;
  licenseNumber: string | null;
  role: ClinicRole;
};

/**
 * The gate on everything clinical.
 *
 * Server Actions are reachable by direct POST, so a check in a layout protects
 * nothing on its own — every action and every query goes through one of these.
 */
export async function requireDoctor(): Promise<CurrentDoctor> {
  const viewer = await requireViewer();
  // Stated as the role it wants rather than the one it refuses: an
  // administrator is staff and holds no clinician profile, and "not a
  // secretary" would have been the wrong question to ask about them.
  if (!viewer.staff || viewer.staff.role !== "DOCTOR" || !viewer.doctorId) {
    redirect(homeFor(viewer));
  }

  const doctor = await orm.Doctor
    .select("id", "fullName", "specialty", "licenseNumber", "clinicName", "clinicId")
    .where((d) => d.id.eq(viewer.doctorId!))
    .first();
  // A clinician profile that has lost its clinic cannot be scoped, so it cannot
  // be used.
  if (!doctor?.clinicId || doctor.clinicId !== viewer.staff.clinicId) {
    redirect(homeFor(viewer));
  }

  return {
    id: doctor.id,
    accountId: viewer.accountId,
    clinicId: doctor.clinicId,
    clinicName: doctor.clinicName ?? viewer.staff.clinicName,
    email: viewer.email,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    licenseNumber: doctor.licenseNumber,
    role: viewer.staff.role,
  };
}

export type CurrentStaff = {
  accountId: string;
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  fullName: string;
  email: string;
  /** Set when this staff member is also a clinician. */
  doctorId: string | null;
};

/**
 * Anybody who works at the clinic: the desk as well as the consulting room.
 *
 * This is the gate for the things a secretary is meant to do — registering
 * people, booking, checking in. It is never the gate for anything clinical.
 */
export async function requireStaff(): Promise<CurrentStaff> {
  const viewer = await requireViewer();
  if (!viewer.staff) redirect(homeFor(viewer));

  return {
    accountId: viewer.accountId,
    clinicId: viewer.staff.clinicId,
    clinicName: viewer.staff.clinicName,
    role: viewer.staff.role,
    fullName: viewer.fullName,
    email: viewer.email,
    doctorId: viewer.doctorId,
  };
}

export type CurrentManager = {
  accountId: string;
  clinicId: string;
  clinicName: string;
  role: ClinicRole;
  fullName: string;
  email: string;
  /** Set when this manager is also the clinic's clinician. */
  doctorId: string | null;
};

/**
 * Who may run the clinic: its clinician, or an administrator.
 *
 * Deliberately separate from `requireDoctor`. Appointing staff, setting opening
 * hours and changing what the letterhead says are the practice's business
 * rather than the consulting room's, and a clinic should be able to employ
 * somebody to do them without also handing them the notes. The 40-odd
 * `requireDoctor` call sites keep meaning "clinician", which is what every
 * clinical page actually needs.
 */
export async function requireClinicManager(): Promise<CurrentManager> {
  const viewer = await requireViewer();
  if (!viewer.staff || viewer.staff.role === "SECRETARY") redirect(homeFor(viewer));

  return {
    accountId: viewer.accountId,
    clinicId: viewer.staff.clinicId,
    clinicName: viewer.staff.clinicName,
    role: viewer.staff.role,
    fullName: viewer.fullName,
    email: viewer.email,
    doctorId: viewer.doctorId,
  };
}

export type CurrentPatient = {
  accountId: string;
  patientId: string;
  clinicId: string;
  fullName: string;
  email: string;
};

/** The gate on the patient portal: one login, one chart, and only that one. */
export async function requirePatientAccount(): Promise<CurrentPatient> {
  const viewer = await requireViewer();
  if (!viewer.patient || !viewer.patient.clinicId) redirect(homeFor(viewer));

  return {
    accountId: viewer.accountId,
    patientId: viewer.patient.id,
    clinicId: viewer.patient.clinicId,
    fullName: viewer.fullName,
    email: viewer.email,
  };
}
