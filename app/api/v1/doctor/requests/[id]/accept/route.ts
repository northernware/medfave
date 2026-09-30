import { apiDoctor, apiError, readJson } from "@/lib/api";
import { acceptAppointmentRequest } from "@/lib/requests";

/**
 * Accept a patient's request, which books it. Body: `{ time?: "HH:MM" }` —
 * required when the patient asked for "any time", otherwise overrides their
 * preferred time. Fails with 409 when the time went while the request waited.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/requests/[id]/accept">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};

  // A new patient: "new" creates their record, a patient id links an existing one.
  const choice = typeof body.record === "string" ? body.record : "";
  const record = choice === "new" ? { create: true as const } : choice ? { linkTo: choice } : undefined;
  const result = await acceptAppointmentRequest(doctor, id, typeof body.time === "string" ? body.time : "", record);
  if (result.ok) return Response.json({ id, status: "ACCEPTED", appointmentId: result.appointmentId });

  switch (result.reason) {
    case "not-found":
      return apiError(404, "No open request with that id.");
    case "needs-time":
      return apiError(422, "The patient asked for any time. Choose one.", { time: ["Choose a time"] });
    case "needs-record":
      return apiError(422, "A new patient: choose a record — record: \"new\" or an existing patient's id.", { record: ["Required"] });
    case "refused":
      return apiError(409, result.message, { time: [result.message] });
  }
}
