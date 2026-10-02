import { apiPatient } from "@/lib/api";
import { lastDoctorFor, pickDoctor } from "@/lib/clinic";
import { ServiceType } from "@/lib/enums";
import { openingsFor } from "@/lib/openings";

/**
 * Times the patient could ask for that are really free. See `openingsFor`.
 *
 * `?doctor=<id>` (left out: the doctor they saw last, else the only one),
 * `?service=<ServiceType>` (left out: a general consultation), and `?date=YYYY-MM-DD`
 * for every free time that day instead of the next few.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const params = new URL(request.url).searchParams;

  const picked = await pickDoctor(me.clinicId, params.get("doctor"), await lastDoctorFor(me.clinicId, me.patientId));
  const asked = params.get("service") ?? "";
  const service = (asked in ServiceType ? asked : "GENERAL_CONSULTATION") as ServiceType;
  const date = params.get("date");
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Use a date like 2026-10-05." }, { status: 400 });
  }
  if (!picked.doctorId) return Response.json({ doctorId: null, service, minutes: null, openings: [] });

  const { minutes, openings } = await openingsFor(picked.doctorId, service, { date: date ?? undefined });
  return Response.json({ doctorId: picked.doctorId, service, minutes, openings });
}
