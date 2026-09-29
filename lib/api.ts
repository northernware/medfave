import "server-only";
import { patientContext, viewerForSession, type CurrentPatient, type Viewer } from "@/lib/auth";
import { describeWeek, durationFor, earliestBookableDay, latestBookableDay } from "@/lib/availability";
import type { Actor } from "@/lib/booking";
import { clinicDoctorId, clinicLetterhead } from "@/lib/clinic";
import { dayKey } from "@/lib/datetime";
import { SERVICES } from "@/lib/domain";
import { loadSchedule } from "@/lib/queries";
import { readAppToken } from "@/lib/session";
import { orm } from "@/src/prisma/db";

/*
 * The JSON API the mobile app talks to, under /api/v1.
 *
 * The same rules as the web pages, answered differently: where a page would
 * redirect to the sign-in screen, the API says 401; where a page would send
 * somebody to their own home, it says 403. Every handler starts from one of
 * the `api*` gates below and never trusts an id it has not scoped to the
 * caller.
 */

export type ApiError = {
  error: string;
  /** Per-field messages, for a form to show beside its inputs. */
  fieldErrors?: Record<string, string[]>;
};

export function apiError(status: number, error: string, fieldErrors?: Record<string, string[]>) {
  const body: ApiError = fieldErrors ? { error, fieldErrors } : { error };
  return Response.json(body, { status });
}

/** A request body as JSON, or null when it is missing or not an object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Anybody signed in with an app token, or a 401 to return as is. */
export async function apiViewer(request: Request): Promise<Viewer | Response> {
  const session = await readAppToken(request.headers.get("authorization"));
  const viewer = session ? await viewerForSession(session) : null;
  return viewer ?? apiError(401, "Sign in again.");
}

/**
 * A patient's own login, scoped to their chart at one clinic.
 *
 * The clinic comes from `?clinic=<clinicId>` or an `X-Clinic-Id` header; left
 * out, the first of their clinics. Naming a clinic the login is not linked to
 * is a 404, not a fallback — the app asked for somewhere it cannot go.
 */
export async function apiPatient(request: Request): Promise<CurrentPatient | Response> {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (viewer.charts.length === 0) return apiError(403, "This is for patient accounts.");

  const asked = new URL(request.url).searchParams.get("clinic") ?? request.headers.get("x-clinic-id");
  if (asked && !viewer.charts.some((c) => c.clinicId === asked)) {
    return apiError(404, "You are not linked to that clinic.");
  }
  return patientContext(viewer, asked)!;
}

/** A clinician, with what `lib/booking` needs to act for them. */
export type ApiDoctor = Actor & { doctorId: string; fullName: string };

/**
 * The clinical gate, as `requireDoctor` on the web: a DOCTOR member of a
 * clinic whose clinician profile belongs to that same clinic.
 */
export async function apiDoctor(request: Request): Promise<ApiDoctor | Response> {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (!viewer.staff || viewer.staff.role !== "DOCTOR" || !viewer.doctorId) {
    return apiError(403, "This is for doctor accounts.");
  }
  const doctor = await orm.Doctor
    .select("id", "clinicId", "verificationStatus")
    .where((d) => d.id.eq(viewer.doctorId!))
    .first();
  // A clinician profile that has lost its clinic cannot be scoped, so it cannot be used.
  if (!doctor?.clinicId || doctor.clinicId !== viewer.staff.clinicId) {
    return apiError(403, "This is for doctor accounts.");
  }
  if (doctor.verificationStatus !== "VERIFIED") {
    return apiError(403, "We're still checking your PRC license. Your clinic opens once it's verified.");
  }
  return {
    accountId: viewer.accountId,
    clinicId: doctor.clinicId,
    role: viewer.staff.role,
    doctorId: doctor.id,
    fullName: viewer.fullName,
  };
}

/**
 * A clinic, and what a booking or request form needs to know about it: the
 * services, the week's hours, closures ahead, and the range of dates it books.
 * The server still checks every booking against the same rules; this lets the
 * app say so first.
 */
export async function clinicBookingInfo(clinicId: string) {
  const [letterhead, doctorId] = await Promise.all([clinicLetterhead(clinicId), clinicDoctorId(clinicId)]);
  const schedule = doctorId ? await loadSchedule(doctorId) : null;
  const today = dayKey(new Date());

  return {
    clinic: letterhead,
    takingRequests: schedule !== null,
    services: SERVICES.map((s) => ({
      value: s.value,
      label: s.label,
      description: s.description,
      minutes: schedule ? durationFor(schedule, s.value, s.minutes) : s.minutes,
    })),
    schedule: schedule
      ? {
          summary: describeWeek(schedule),
          hours: schedule.hours,
          breaks: schedule.breaks,
          closures: schedule.closures.filter((c) => c.endsOn >= today),
          slotStepMinutes: schedule.slotStepMinutes,
          earliestDay: earliestBookableDay(schedule),
          latestDay: latestBookableDay(schedule),
          today,
        }
      : null,
  };
}

/** What the app needs to know about who signed in, and which side of it to open. */
export function viewerSummary(viewer: Viewer) {
  return {
    id: viewer.accountId,
    email: viewer.email,
    fullName: viewer.fullName,
    // Work comes first, as on the web (`homeFor`): a doctor who is also
    // somebody's patient elsewhere opens the doctor side.
    // A doctor whose license isn't verified yet has no doctor side to open;
    // `verification` says where they stand.
    role: viewer.doctorId && viewer.staff?.role === "DOCTOR" && viewer.verification?.status === "VERIFIED"
      ? "doctor"
      : viewer.charts.length > 0
        ? "patient"
        : viewer.staff && viewer.clinicOpen
          ? "staff"
          : "none",
    clinic: viewer.staff ? { id: viewer.staff.clinicId, name: viewer.staff.clinicName, role: viewer.staff.role } : null,
    /** Every clinic this patient login is linked to, each with its own chart. */
    charts: viewer.charts.map((c) => ({ patientId: c.id, clinic: { id: c.clinicId, name: c.clinicName } })),
    emailVerified: viewer.emailVerified,
    /** What they said they were at sign-up: picks the welcome for an account with no clinic yet. */
    signupRole: viewer.signupRole,
    /** The first chart's id. Kept for older app builds; use `charts`. */
    patientId: viewer.charts[0]?.id ?? null,
    doctorId: viewer.doctorId,
    /** The license check, for a doctor: `{ status: "PENDING" | "VERIFIED" | "DECLINED", declineReason }`. */
    verification: viewer.verification,
  } as const;
}
