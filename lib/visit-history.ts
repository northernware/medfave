import "server-only";
import { orm } from "@/src/prisma/db";
import { formatDateTime, instantFromDb } from "@/lib/datetime";

/*
 * A visit's story, oldest first: asked for (and by whom), accepted, booked,
 * then every status change and move since, with who did it. Assembled from
 * the request, the appointment and its `AppointmentEvent`s. Visits from before
 * the log fall back to the arrival and consultation times the visit kept.
 */

export type HistoryEntry = { at: Date; label: string; by: string | null; detail?: string };

export async function visitHistory(appointmentId: string, clinicId: string): Promise<HistoryEntry[]> {
  const [visit, requests, events] = await Promise.all([
    orm.Appointment
      .select("createdAt", "source", "arrivedAt", "consultationStartedAt")
      .include("bookedBy", (a) => a.select("fullName"))
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.clinicId.eq(clinicId))
      .first(),
    orm.AppointmentRequest
      .select("createdAt", "decidedAt", "forOther", "rescheduleOfId")
      .include("requestedBy", (a) => a.select("fullName"))
      .include("decidedBy", (a) => a.select("fullName"))
      .where((r) => r.appointmentId.eq(appointmentId))
      .where((r) => r.clinicId.eq(clinicId))
      .all(),
    orm.AppointmentEvent
      .select("status", "previousScheduledAt", "at")
      .include("by", (a) => a.select("fullName"))
      .where((e) => e.appointmentId.eq(appointmentId))
      .where((e) => e.clinicId.eq(clinicId))
      .orderBy((e) => e.at.asc())
      .all(),
  ]);
  if (!visit) return [];

  const entries: HistoryEntry[] = [];
  const request = requests[0];
  if (request) {
    entries.push({
      at: instantFromDb(request.createdAt),
      label: request.rescheduleOfId ? "Asked to move a visit" : request.forOther ? "Requested for them" : "Requested",
      by: request.requestedBy.fullName,
    });
    if (request.decidedAt) {
      entries.push({ at: instantFromDb(request.decidedAt), label: "Accepted and booked", by: request.decidedBy?.fullName ?? null });
    }
  } else {
    entries.push({
      at: instantFromDb(visit.createdAt),
      label: visit.source === "WALK_IN" ? "Booked as a walk-in" : visit.source === "PHONE" ? "Booked by phone" : "Booked",
      by: visit.bookedBy?.fullName ?? null,
    });
  }

  const LABEL: Record<string, string> = {
    PENDING: "Set to pending",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked in",
    IN_CONSULTATION: "Consultation started",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "Marked no-show",
  };
  let checkedIn = false;
  let started = false;
  let wasCheckedIn = false;
  for (const e of events) {
    const status = e.status ?? "";
    const moved = e.previousScheduledAt ? formatDateTime(instantFromDb(e.previousScheduledAt)) : null;
    let label = LABEL[status] ?? "Changed";
    let detail: string | undefined;
    // A new time, without a status change: rescheduled.
    if (!status && moved) {
      entries.push({ at: instantFromDb(e.at), label: "Time changed", by: e.by?.fullName ?? null, detail: `Was ${moved}` });
      continue;
    }
    if (status === "CHECKED_IN" || status === "IN_CONSULTATION") {
      if (moved) detail = `Arrived on another day: moved from ${moved}`;
    } else if (status === "CONFIRMED" && wasCheckedIn) {
      label = "Check-in undone";
      if (moved) detail = `Back to its booked time`;
    }
    if (status === "CHECKED_IN") checkedIn = true;
    if (status === "IN_CONSULTATION") started = true;
    wasCheckedIn = status === "CHECKED_IN";
    entries.push({ at: instantFromDb(e.at), label, by: e.by?.fullName ?? null, detail });
  }

  // From before the log: the times the visit itself kept.
  if (!checkedIn && !started && visit.arrivedAt) {
    entries.push({ at: instantFromDb(visit.arrivedAt), label: "Checked in", by: null });
  }
  if (!started && visit.consultationStartedAt) {
    entries.push({ at: instantFromDb(visit.consultationStartedAt), label: "Consultation started", by: null });
  }

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}
