import { apiError, apiPatient, readJson } from "@/lib/api";
import { calendarDateFromDb, instantFromDb, toDateInputValue } from "@/lib/datetime";
import { SERVICE_LABELS } from "@/lib/domain";
import { createAppointmentRequest } from "@/lib/requests";
import { orm } from "@/src/prisma/db";

/** The patient's own requests, newest first, with the clinic's answer when there is one. */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;

  const requests = await orm.AppointmentRequest
    .select("id", "preferredDate", "preferredTime", "service", "reason", "status", "decisionNote", "createdAt", "rescheduleOfId")
    .include("doctor", (d) => d.select("id", "fullName"))
    .where((r) => r.patientId.eq(me.patientId))
    .orderBy((r) => r.createdAt.desc())
    .limit(50)
    .all();
  // For a move: the time the visit has now, so the card can say "from … to …".
  const movingIds = requests.flatMap((r) => (r.rescheduleOfId ? [r.rescheduleOfId] : []));
  const moving = movingIds.length
    ? await orm.Appointment.select("id", "scheduledAt").where((a) => a.id.in(movingIds)).all()
    : [];

  return Response.json({
    requests: requests.map((r) => ({
      id: r.id,
      preferredDate: toDateInputValue(calendarDateFromDb(r.preferredDate)),
      preferredTime: r.preferredTime,
      service: r.service,
      serviceLabel: SERVICE_LABELS[r.service],
      reason: r.reason,
      status: r.status,
      decisionNote: r.decisionNote,
      createdAt: instantFromDb(r.createdAt).toISOString(),
      /** Set when this asks to move an existing visit. */
      rescheduleOf: r.rescheduleOfId,
      /** That visit's current time, for a move. */
      rescheduleFrom: (() => {
        const visit = moving.find((a) => a.id === r.rescheduleOfId);
        return visit ? instantFromDb(visit.scheduledAt).toISOString() : null;
      })(),
      doctor: r.doctor ? { id: r.doctor.id, fullName: r.doctor.fullName } : null,
    })),
  });
}

/**
 * Ask for a visit. A request is not a booking: it holds no slot, and the
 * doctor or front desk accepts or declines it.
 *
 * Body: `{ service, preferredDate: "YYYY-MM-DD", preferredTime?: "HH:MM", reason, rescheduleOf? }`.
 * `rescheduleOf` (an upcoming visit's id) asks to move that visit: same doctor,
 * and the old time is freed when the clinic accepts.
 */
export async function POST(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;

  const body = await readJson(request);
  if (!body) return apiError(400, "Send the request as JSON.");
  const text = (v: unknown) => (typeof v === "string" ? v : "");

  const result = await createAppointmentRequest(me, {
    service: text(body.service),
    preferredDate: text(body.preferredDate),
    preferredTime: text(body.preferredTime),
    reason: text(body.reason),
    doctorId: text(body.doctorId) || undefined,
    rescheduleOf: text(body.rescheduleOf) || undefined,
  });
  if (!result.ok) return apiError(422, result.message ?? "Check the details of your request.", result.fieldErrors);

  return Response.json({ id: result.id, status: "PENDING" }, { status: 201 });
}
