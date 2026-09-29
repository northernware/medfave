import { apiPatient, clinicBookingInfo } from "@/lib/api";
import { lastDoctorFor } from "@/lib/clinic";

/**
 * The patient's clinic, and what the request form needs to know about it. See
 * `clinicBookingInfo`. `?doctor=<id>` asks for that doctor's hours; left out,
 * the doctor the patient saw last.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const asked = new URL(request.url).searchParams.get("doctor");
  return Response.json(
    await clinicBookingInfo(me.clinicId, { doctorId: asked, fallback: await lastDoctorFor(me.clinicId, me.patientId) }),
  );
}
