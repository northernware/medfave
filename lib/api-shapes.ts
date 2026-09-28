import "server-only";
import { instantFromDb } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, fullName, SERVICE_LABELS, STATUS_TRANSITIONS } from "@/lib/domain";
import type { AppointmentStatus, BookingSource, ServiceType } from "@/lib/enums";

/*
 * How the API describes things to the doctor's side of the app, so every
 * endpoint that returns an appointment returns the same shape.
 */

type Name = { firstName: string; middleName: string | null; lastName: string };

export type AppointmentRow = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  service: ServiceType;
  reason: string | null;
  status: AppointmentStatus;
  source: BookingSource;
  arrivedAt: string | null;
  consultationStartedAt: string | null;
  patient: Name & { id: string };
};

/** The columns `shapeAppointment` needs, for `.select(...)`. */
export const APPOINTMENT_COLUMNS = [
  "id",
  "scheduledAt",
  "durationMinutes",
  "service",
  "reason",
  "status",
  "source",
  "arrivedAt",
  "consultationStartedAt",
] as const;

export function shapeAppointment(a: AppointmentRow) {
  return {
    id: a.id,
    scheduledAt: instantFromDb(a.scheduledAt).toISOString(),
    durationMinutes: a.durationMinutes,
    service: a.service,
    serviceLabel: SERVICE_LABELS[a.service],
    reason: a.reason,
    status: a.status,
    statusLabel: APPOINTMENT_STATUS_LABELS[a.status],
    source: a.source,
    arrivedAt: a.arrivedAt ? instantFromDb(a.arrivedAt).toISOString() : null,
    consultationStartedAt: a.consultationStartedAt ? instantFromDb(a.consultationStartedAt).toISOString() : null,
    patient: { id: a.patient.id, fullName: fullName(a.patient) },
    /** Where this visit may move next — the only statuses the status endpoint will accept. */
    nextStatuses: STATUS_TRANSITIONS[a.status].map((s) => ({ status: s, label: APPOINTMENT_STATUS_LABELS[s] })),
  };
}
