import { apiError, apiViewer, clinicBookingInfo } from "@/lib/api";
import { findDoctor } from "@/lib/discovery";
import { isFaved } from "@/lib/faves";
import { orm } from "@/src/prisma/db";

/**
 * A doctor's profile for requesting a visit: who they are, their clinic, and
 * their hours, services and booking window (as `/patient/clinic`). `chart` is
 * the caller's record at that clinic, if they have one; `faved`, whether they
 * keep this doctor in their faves.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/discover/doctors/[id]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const { id } = await ctx.params;
  const doctor = await findDoctor(id);
  if (!doctor) return apiError(404, "No doctor with that id.");
  const [booking, chart, faved] = await Promise.all([
    clinicBookingInfo(doctor.clinic.id, { doctorId: doctor.id }),
    orm.Patient.select("id").where((p) => p.clinicId.eq(doctor.clinic.id)).where((p) => p.accountId.eq(viewer.accountId)).first(),
    isFaved(viewer.accountId, doctor.id),
  ]);
  return Response.json({ doctor, booking, knownPatient: Boolean(chart), faved });
}
