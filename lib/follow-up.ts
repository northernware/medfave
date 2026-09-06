import type { AppointmentStatus } from "@/lib/enums";

/**
 * Where a visit's follow-up requirement stands.
 *
 * Only `CLOSED` is stored. Everything else is derived, on every read, from the
 * follow-up date and the *status* of the appointment booked against it — never
 * from the mere existence of that appointment. That is the whole point: a
 * booking that is later cancelled, missed, or deleted stops counting as
 * resolved the moment its status says so, and the patient returns to the queue
 * without a background job needing to notice.
 */
export type FollowUpState =
  | "NOT_REQUIRED"
  | "SCHEDULED"
  | "COMPLETED"
  | "CLOSED"
  | "DUE"
  | "OVERDUE";

/** Statuses that mean the booked follow-up is still going to happen. */
const STILL_EXPECTED: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_CONSULTATION",
];

export type FollowUpInput = {
  followUpDate: Date | null;
  followUpClosedAt: Date | null;
  /** The appointment booked to satisfy this follow-up, if one still exists. */
  followUpAppointment: { status: AppointmentStatus } | null;
};

export type FollowUpVerdict = {
  state: FollowUpState;
  /** Set when a booking existed and fell through, so the UI can say why. */
  returnedBy: "CANCELLED" | "NO_SHOW" | null;
};

export function followUpState(record: FollowUpInput, today: Date = new Date()): FollowUpVerdict {
  if (!record.followUpDate) return { state: "NOT_REQUIRED", returnedBy: null };
  if (record.followUpClosedAt) return { state: "CLOSED", returnedBy: null };

  const appointment = record.followUpAppointment;
  if (appointment) {
    if (appointment.status === "COMPLETED") return { state: "COMPLETED", returnedBy: null };
    if (STILL_EXPECTED.includes(appointment.status)) {
      return { state: "SCHEDULED", returnedBy: null };
    }
  }

  // No booking, or one that was cancelled or missed: the requirement is live
  // again. `returnedBy` explains which, so the queue can show it.
  const returnedBy =
    appointment?.status === "CANCELLED" || appointment?.status === "NO_SHOW"
      ? appointment.status
      : null;

  const overdue = record.followUpDate < startOfDay(today);
  return { state: overdue ? "OVERDUE" : "DUE", returnedBy };
}

/** True when the follow-up still needs someone to act on it. */
export function needsAction(state: FollowUpState) {
  return state === "DUE" || state === "OVERDUE";
}

function startOfDay(at: Date) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export const FOLLOW_UP_LABELS: Record<FollowUpState, string> = {
  NOT_REQUIRED: "No follow-up",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CLOSED: "No longer required",
  DUE: "Due",
  OVERDUE: "Overdue",
};

export const FOLLOW_UP_TONE: Record<FollowUpState, "neutral" | "accent" | "ok" | "warn" | "danger"> =
  {
    NOT_REQUIRED: "neutral",
    SCHEDULED: "accent",
    COMPLETED: "ok",
    CLOSED: "neutral",
    DUE: "warn",
    OVERDUE: "danger",
  };

export const RETURNED_BY_LABELS: Record<"CANCELLED" | "NO_SHOW", string> = {
  CANCELLED: "the booked visit was cancelled",
  NO_SHOW: "the patient did not attend",
};
