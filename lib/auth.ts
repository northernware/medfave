import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { instantFromDb } from "@/lib/datetime";
import type { ClinicRole, SignupRole } from "@/lib/enums";

type VerificationStatus = "PENDING" | "VERIFIED" | "DECLINED";
import { readSession, type Session } from "./session";

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
  /**
   * This person's chart at each clinic that has linked them, sorted by clinic
   * name. Empty for a staff-only account. One login, many clinics — but each
   * clinic's chart is its own, and nothing here merges them.
   */
  charts: PatientChart[];
  /** Whether they have followed the link sent to their email. */
  emailVerified: boolean;
  /** What they said they were at sign-up. Picks their welcome; grants nothing. */
  signupRole: SignupRole | null;
  /** Their license check, when they have a clinician profile. */
  verification: { status: VerificationStatus; declineReason: string | null } | null;
  /**
   * Whether their clinic is open for clinical work: it has a verified doctor.
   * False until then, for every member — see `requireStaff`.
   */
  clinicOpen: boolean;
  /** Runs Medfave itself: may verify doctors. */
  platformAdmin: boolean;
};

export type PatientChart = { id: string; clinicId: string; clinicName: string };

/** Cached per request, so a layout and its pages share one lookup. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  return viewerForSession(session);
});

/**
 * Who a session belongs to, read from the database — for the browser's cookie
 * and the app's bearer token alike, so both are held to the same rules.
 */
export async function viewerForSession(session: Session): Promise<Viewer | null> {

  const account = await orm.Account
    .select("id", "email", "fullName", "sessionsValidFrom", "emailVerifiedAt", "signupRole", "platformAdmin")
    .include("memberships", (m) =>
      m.select("clinicId", "role").include("clinic", (c) => c.select("name")),
    )
    .include("doctorProfile", (d) => d.select("id", "verificationStatus", "declineReason"))
    .include("patientProfiles", (p) => p.select("id", "clinicId").include("clinic", (c) => c.select("name")))
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

  const verifiedDoctor = membership
    ? await orm.Doctor
        .select("id")
        .where((d) => d.clinicId.eq(membership.clinicId))
        .where((d) => d.verificationStatus.eq("VERIFIED"))
        .first()
    : null;

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
    charts: account.patientProfiles
      .map((p) => ({ id: p.id, clinicId: p.clinicId, clinicName: p.clinic.name }))
      .sort((a, b) => a.clinicName.localeCompare(b.clinicName)),
    emailVerified: account.emailVerifiedAt !== null,
    signupRole: account.signupRole,
    verification: account.doctorProfile
      ? { status: account.doctorProfile.verificationStatus, declineReason: account.doctorProfile.declineReason }
      : null,
    clinicOpen: verifiedDoctor !== null,
    platformAdmin: account.platformAdmin,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Where an account belongs when it lands on the wrong door. */
export function homeFor(viewer: Viewer) {
  // A clinic waiting on its license check: its doctor sets it up from Manage,
  // where the check's status is. Nobody else can be a member yet.
  if (viewer.staff && !viewer.clinicOpen) return viewer.staff.role === "SECRETARY" ? "/welcome" : "/manage";
  if (viewer.staff?.role === "SECRETARY") return "/desk";
  // An administrator runs the clinic without practising in it, so the clinical
  // section is not theirs. Sending them to "/dashboard" was an infinite redirect: the
  // clinical gate bounced them straight back here.
  if (viewer.staff?.role === "ADMIN") return "/manage";
  if (viewer.staff) return "/dashboard";
  if (viewer.charts.length > 0) return "/portal";
  // Signed up, but not yet a patient anywhere or a member of a clinic.
  return "/welcome";
}

export type CurrentDoctor = {
  /** The clinician profile's id — what authorship on a note points at. */
  id: string;
  accountId: string;
  clinicId: string;
  /** The clinic's own name — `Clinic.name`, the one copy there is. */
  clinicName: string;
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
    .select("id", "fullName", "specialty", "licenseNumber", "clinicId", "verificationStatus")
    .where((d) => d.id.eq(viewer.doctorId!))
    .first();
  // Nothing clinical until a Medfave admin has checked the license.
  if (doctor?.verificationStatus !== "VERIFIED") redirect("/manage");
  // A clinician profile that has lost its clinic cannot be scoped, so it cannot
  // be used.
  if (!doctor?.clinicId || doctor.clinicId !== viewer.staff.clinicId) {
    redirect(homeFor(viewer));
  }

  return {
    id: doctor.id,
    accountId: viewer.accountId,
    clinicId: doctor.clinicId,
    // Not `Doctor.clinicName`: that column predates clinics and is no longer
    // read. Two copies of one name is two answers the first time either changes,
    // and it was this line that made the printed paper disagree with everything
    // else.
    clinicName: viewer.staff.clinicName,
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
  // The desk's work is patients and bookings: closed until the clinic is verified.
  if (!viewer.staff || !viewer.clinicOpen) redirect(homeFor(viewer));

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
  /** False while the clinic waits on its license check: no staff invitations yet. */
  clinicOpen: boolean;
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
    clinicOpen: viewer.clinicOpen,
  };
}

/** Somebody who runs Medfave itself. Everybody else is sent home. */
export async function requirePlatformAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.platformAdmin) redirect(homeFor(viewer));
  return viewer;
}

export type CurrentPatient = {
  accountId: string;
  /** The chart being acted on — at `clinicId`, and only that one. */
  patientId: string;
  clinicId: string;
  clinicName: string;
  fullName: string;
  email: string;
  /** Every clinic this login is linked to, for a switcher. */
  charts: PatientChart[];
};

/** The cookie that remembers which of a patient's clinics the portal shows. */
export const PORTAL_CLINIC_COOKIE = "portal_clinic";

/**
 * One chart of a patient's, and the context around it.
 *
 * `clinicId` picks which, when the login is linked to several clinics; an
 * unknown or missing one falls back to the first. Every query made with the
 * result is scoped to that one chart, so a patient at two clinics sees each
 * clinic's records separately and never together.
 */
export function patientContext(viewer: Viewer, clinicId?: string | null): CurrentPatient | null {
  const chart = viewer.charts.find((c) => c.clinicId === clinicId) ?? viewer.charts[0];
  if (!chart) return null;
  return {
    accountId: viewer.accountId,
    patientId: chart.id,
    clinicId: chart.clinicId,
    clinicName: chart.clinicName,
    fullName: viewer.fullName,
    email: viewer.email,
    charts: viewer.charts,
  };
}

/** The gate on the patient portal: the chart at the clinic the patient has chosen, and only that one. */
export async function requirePatientAccount(): Promise<CurrentPatient> {
  const viewer = await requireViewer();
  // A chart always has a clinic now — the database refuses one without — so
  // having a chart is the whole test.
  const chosen = (await cookies()).get(PORTAL_CLINIC_COOKIE)?.value;
  const patient = patientContext(viewer, chosen);
  if (!patient) redirect(homeFor(viewer));
  return patient;
}
