import "server-only";
import { instantFromDb } from "@/lib/datetime";
import { orm } from "@/src/prisma/db";

type Orm = typeof orm;

/**
 * Times still held by early check-ins.
 *
 * Checking in a visit booked for another day moves it to now, but its old time
 * stays held while it is only checked in: undoing the check-in (a slip of the
 * thumb, the wrong patient) must be able to put it back. Once the consultation
 * starts there is no undo, and the old time is free again.
 *
 * Returns each held time between `from` and `to` for this doctor, as the
 * instant it starts and its length. `ignoreAppointmentId` leaves out the visit
 * being moved, so undoing a check-in doesn't clash with its own hold.
 */
export async function heldSlots(
  doctorId: string,
  from: Date,
  to: Date,
  options: { q?: Orm; ignoreAppointmentId?: string } = {},
) {
  const q = options.q ?? orm;
  // Few visits are checked in at once, so start from them.
  const checkedIn = await q.Appointment
    .select("id", "durationMinutes", "status")
    .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
    .where((a) => a.doctorId.eq(doctorId))
    .where((a) => a.status.eq("CHECKED_IN"))
    .all();
  const visits = checkedIn.filter((a) => a.id !== options.ignoreAppointmentId);
  if (visits.length === 0) return [];

  const events = await q.AppointmentEvent
    .select("appointmentId", "previousScheduledAt", "at")
    .where((e) => e.appointmentId.in(visits.map((a) => a.id)))
    .where((e) => e.status.eq("CHECKED_IN"))
    .orderBy((e) => e.at.desc())
    .all();

  const held: { id: string; scheduledAt: Date; durationMinutes: number; patient: (typeof visits)[number]["patient"] }[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    // Only the latest check-in counts: an earlier one may have been undone.
    if (seen.has(e.appointmentId)) continue;
    seen.add(e.appointmentId);
    if (!e.previousScheduledAt) continue;
    const at = instantFromDb(e.previousScheduledAt);
    if (at < from || at >= to) continue;
    const visit = visits.find((a) => a.id === e.appointmentId)!;
    held.push({ id: visit.id, scheduledAt: at, durationMinutes: visit.durationMinutes, patient: visit.patient });
  }
  return held;
}
