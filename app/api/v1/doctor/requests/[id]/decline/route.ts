import { apiDoctor, apiError, readJson } from "@/lib/api";
import { declineAppointmentRequest } from "@/lib/requests";

/** Decline a patient's request. Body: `{ note? }` — a reason the patient will read. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/requests/[id]/decline">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};

  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  const declined = await declineAppointmentRequest(doctor, id, note);
  if (!declined) return apiError(404, "No open request with that id.");
  return Response.json({ id, status: "DECLINED" });
}
