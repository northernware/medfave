import { apiPatient } from "@/lib/api";
import { clinicDayRange, instantFromDb, instantToDb } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, SERVICE_LABELS } from "@/lib/domain";
import { cancelBy, cancelCutoffHours, CHANGEABLE } from "@/lib/patient-visits";
import { orm } from "@/src/prisma/db";

/** A visit not yet over: booked, or at the clinic now. */
const UNDERWAY = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_CONSULTATION"] as const;

/**
 * The patient's own visits: what is coming and what has been.
 *
 * Scoped to the chart this login was activated against, like the portal —
 * nothing here takes an id from the request.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const now = instantToDb(new Date());

  const [ahead, before] = await Promise.all([
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType")
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(50)
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType")
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(50)
      .all(),
  ]);
  // Today's visit stays "upcoming" past its start time until it's over: the
  // patient may still be in the waiting room, or with the doctor.
  const today = clinicDayRange(new Date()).start;
  const underway = (a: (typeof before)[number]) =>
    (UNDERWAY as readonly string[]).includes(a.status) && instantFromDb(a.scheduledAt) >= today;
  const upcoming = [...before.filter(underway).reverse(), ...ahead];
  const past = before.filter((a) => !underway(a));

  const [hours, moves] = await Promise.all([
    cancelCutoffHours(me.clinicId),
    orm.AppointmentRequest
      .select("rescheduleOfId")
      .where((r) => r.patientId.eq(me.patientId))
      .where((r) => r.status.eq("PENDING"))
      .all(),
  ]);
  const moving = new Set(moves.map((m) => m.rescheduleOfId).filter(Boolean));
  const changeable = (a: (typeof ahead)[number]) => (CHANGEABLE as readonly string[]).includes(a.status);

  const shape = (a: (typeof ahead)[number]) => ({
    id: a.id,
    scheduledAt: instantFromDb(a.scheduledAt).toISOString(),
    durationMinutes: a.durationMinutes,
    service: a.service,
    serviceLabel: SERVICE_LABELS[a.service],
    reason: a.reason,
    status: a.status,
    statusLabel: APPOINTMENT_STATUS_LABELS[a.status],
    visitType: a.visitType,
    doctor: a.doctor.fullName,
    doctorId: a.doctor.id,
  });
  // What the patient may still do with a visit to come.
  const upcomingShape = (a: (typeof ahead)[number]) => {
    const by = cancelBy(instantFromDb(a.scheduledAt), hours);
    return {
      ...shape(a),
      canCancel: changeable(a) && Date.now() <= by.getTime(),
      cancelBy: by.toISOString(),
      // Not once its time has come: today's late-running visit can't be moved from here.
      canMove: changeable(a) && !moving.has(a.id) && instantFromDb(a.scheduledAt).getTime() > Date.now(),
      movePending: moving.has(a.id),
    };
  };

  return Response.json({ upcoming: upcoming.map(upcomingShape), past: past.map(shape), cancelHours: hours });
}
