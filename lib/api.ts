import "server-only";
import { viewerForSession, type CurrentPatient, type Viewer } from "@/lib/auth";
import { readAppToken } from "@/lib/session";

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

/** A patient's own login, scoped to their one chart. */
export async function apiPatient(request: Request): Promise<CurrentPatient | Response> {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (!viewer.patient) return apiError(403, "This is for patient accounts.");
  return {
    accountId: viewer.accountId,
    patientId: viewer.patient.id,
    clinicId: viewer.patient.clinicId,
    fullName: viewer.fullName,
    email: viewer.email,
  };
}

/** What the app needs to know about who signed in, and which side of it to open. */
export function viewerSummary(viewer: Viewer) {
  return {
    id: viewer.accountId,
    email: viewer.email,
    fullName: viewer.fullName,
    role: viewer.patient ? "patient" : viewer.doctorId ? "doctor" : viewer.staff ? "staff" : "none",
    clinic: viewer.staff ? { id: viewer.staff.clinicId, name: viewer.staff.clinicName, role: viewer.staff.role } : null,
    patientId: viewer.patient?.id ?? null,
    doctorId: viewer.doctorId,
  } as const;
}
