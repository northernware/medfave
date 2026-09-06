import type { AppointmentStatus } from "@/lib/enums";
import { CLINIC_TIME_ZONE, dayKey, fromDateTimeLocalValue } from "./datetime";
import { blockedIntervals, fullDayClosure, hoursFor, type Schedule } from "./availability";

/**
 * Slot arithmetic. The rules themselves — which days, which hours, which
 * breaks — live in lib/availability.ts and come from the clinic's own settings.
 * Nothing here decides when the clinic is open.
 */
/** A calendar day key with `days` added — plain UTC arithmetic, no zone risk. */
export function addDays(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(at.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}




/**
 * Statuses that hold a slot.
 *
 * A cancelled visit frees its time, and so does a no-show: the patient did not
 * come, so the time is available to give to someone else. Both remain in the
 * record — freeing the slot is about availability, not about forgetting.
 */
export function occupiesSlot(status: AppointmentStatus) {
  return status !== "CANCELLED" && status !== "NO_SHOW";
}

export type BusyInterval = { start: number; end: number };


/** Minutes since midnight, in clinic time. */
export function minuteOfDay(at: Date) {
  const start = fromDateTimeLocalValue(`${dayKey(at)}T00:00`)!;
  return Math.round((at.getTime() - start.getTime()) / 60_000);
}

/** True when [start, start+duration) overlaps anything already booked. */
export function overlaps(startMinute: number, durationMinutes: number, busy: BusyInterval[]) {
  const end = startMinute + durationMinutes;
  return busy.some((b) => startMinute < b.end && end > b.start);
}

export type Slot = { minute: number; value: string; label: string; free: boolean };

/**
 * Every start time on the grid for one day, each marked free or taken. Returns
 * an empty list for a closed or out-of-window day, so the caller needs no
 * special case.
 *
 * The window is passed in rather than derived from `new Date()` so the browser
 * and the server agree: the client's clock and timezone are its own.
 */
export function slotsForDay(
  key: string,
  durationMinutes: number,
  busy: BusyInterval[],
  window: { earliest: string; latest: string },
  schedule: Schedule,
  /**
   * The clinic's current day and minute, from the server. Slots that have
   * already run out on that day are shown taken rather than offered — the
   * walk-in window opens today, which is the only case where "now" is inside
   * the bookable range at all. The browser's own clock is not consulted: it is
   * in the visitor's timezone, not the clinic's.
   */
  now?: { key: string; minute: number },
): Slot[] {
  if (key < window.earliest || key > window.latest) return [];
  if (fullDayClosure(schedule, key)) return [];

  const hours = hoursFor(schedule, key);
  if (!hours) return [];

  // Breaks and timed closures make a slot unavailable exactly as a booking
  // does, so they join the same busy list rather than being a separate case.
  const unavailable = [...busy, ...blockedIntervals(schedule, key)];

  const passed = now && now.key === key ? now.minute : null;

  const slots: Slot[] = [];
  for (
    let m = hours.openMinute;
    m + durationMinutes <= hours.closeMinute;
    m += schedule.slotStepMinutes
  ) {
    const gone = passed !== null && m + durationMinutes <= passed;
    slots.push({
      minute: m,
      value: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      label: labelForMinute(m),
      free: !gone && !overlaps(m, durationMinutes, unavailable),
    });
  }
  return slots;
}

/** "9:00 AM" from minutes since midnight, without constructing a Date. */
export function labelForMinute(m: number) {
  const hour24 = Math.floor(m / 60);
  const minute = m % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "9:00 AM to 9:30 AM" — for naming the booking a clash collided with. */
export function formatSpan(startMinute: number, durationMinutes: number) {
  return `${labelForMinute(startMinute)} to ${labelForMinute(startMinute + durationMinutes)}`;
}

/** Timezone note for the UI, so "8:00 AM" is never ambiguous. */
export const CLINIC_ZONE_LABEL = CLINIC_TIME_ZONE.replace(/_/g, " ");
