import { apiPatient } from "@/lib/api";
import { instantFromDb, instantToDb } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, SERVICE_LABELS } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

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

  const [upcoming, past] = await Promise.all([
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType")
      .include("doctor", (d) => d.select("fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(50)
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType")
      .include("doctor", (d) => d.select("fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(50)
      .all(),
  ]);

  const shape = (a: (typeof upcoming)[number]) => ({
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
  });

  return Response.json({ upcoming: upcoming.map(shape), past: past.map(shape) });
}
