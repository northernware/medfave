import { apiDoctor, apiError, readJson } from "@/lib/api";
import { bookAppointment } from "@/lib/booking";

/**
 * Book a visit, or a walk-in.
 *
 * Body: `{ patientId, service, reason, date: "YYYY-MM-DD", time: "HH:MM", walkIn?: boolean }`.
 * A walk-in skips the clinic's booking lead time (the patient is at the desk)
 * and joins the queue as checked in. Same rules, lock and overlap check as the
 * web booking form.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const body = await readJson(request);
  if (!body) return apiError(400, "Send the booking as JSON.");
  const text = (v: unknown) => (typeof v === "string" ? v : "");

  const result = await bookAppointment(doctor, {
    patientId: text(body.patientId),
    service: text(body.service),
    reason: text(body.reason),
    date: text(body.date),
    time: text(body.time),
    source: body.walkIn === true ? "WALK_IN" : "STAFF",
    status: "CONFIRMED",
  });
  if (!result.ok) {
    return apiError(result.clash ? 409 : 422, result.message ?? "Check the booking details.", result.fieldErrors);
  }
  return Response.json({ id: result.id }, { status: 201 });
}
