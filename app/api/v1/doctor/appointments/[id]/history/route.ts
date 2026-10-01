import { apiDoctor, apiError } from "@/lib/api";
import { visitHistory } from "@/lib/visit-history";
import { orm } from "@/src/prisma/db";

/**
 * A visit's history, oldest first → `{ history: [{ at, label, by, detail }] }`:
 * requested, accepted, booked, checked in, started… and who did each.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/appointments/[id]/history">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const visit = await orm.Appointment.select("id").where((a) => a.id.eq(id)).where((a) => a.clinicId.eq(doctor.clinicId)).first();
  if (!visit) return apiError(404, "No visit with that id.");
  const history = await visitHistory(id, doctor.clinicId);
  return Response.json({
    history: history.map((h) => ({ at: h.at.toISOString(), label: h.label, by: h.by, detail: h.detail ?? null })),
  });
}
