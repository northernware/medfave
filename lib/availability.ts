import type { ServiceType } from "@/lib/enums";
import { addDays, minuteOfDay, overlaps, type BusyInterval } from "./scheduling";
import { dayKey } from "./datetime";

/**
 * A clinic's own schedule, resolved from its settings rows.
 *
 * Availability used to be three module constants — open at 8, shut at 5, closed
 * on Sundays. It is data now, so a clinic can describe its own week. The
 * defaults below are what an unconfigured clinic gets, and they match the old
 * constants exactly so nothing changes until someone configures something.
 */
export type OpeningHours = { weekday: number; openMinute: number; closeMinute: number };
export type Break = { weekday: number | null; startMinute: number; endMinute: number; label: string };
export type Closure = {
  startsOn: string;
  endsOn: string;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
};

export type Schedule = {
  hours: OpeningHours[];
  breaks: Break[];
  closures: Closure[];
  slotStepMinutes: number;
  minLeadMinutes: number;
  maxLeadDays: number;
  defaultDurationMinutes: number;
  serviceDurations: Partial<Record<ServiceType, number>>;
};

/** Monday to Saturday, 8:00 to 17:00 — the behaviour before any of this was configurable. */
export const DEFAULT_SCHEDULE: Schedule = {
  hours: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, openMinute: 8 * 60, closeMinute: 17 * 60 })),
  breaks: [],
  closures: [],
  slotStepMinutes: 15,
  minLeadMinutes: 24 * 60,
  maxLeadDays: 180,
  defaultDurationMinutes: 30,
  serviceDurations: {},
};

export function weekdayOfKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The opening hours for one day, or null when the clinic does not open. */
export function hoursFor(schedule: Schedule, key: string): OpeningHours | null {
  const weekday = weekdayOfKey(key);
  return schedule.hours.find((h) => h.weekday === weekday) ?? null;
}

/** A whole-day closure covering this date, if any. */
export function fullDayClosure(schedule: Schedule, key: string): Closure | null {
  return (
    schedule.closures.find(
      (c) =>
        c.startMinute === null && c.endMinute === null && key >= c.startsOn && key <= c.endsOn,
    ) ?? null
  );
}

/**
 * Every minute range on a day that is unavailable for reasons other than an
 * existing appointment: breaks, and the timed part of any closure.
 */
export function blockedIntervals(schedule: Schedule, key: string): BusyInterval[] {
  const weekday = weekdayOfKey(key);
  const blocks: BusyInterval[] = schedule.breaks
    .filter((b) => b.weekday === null || b.weekday === weekday)
    .map((b) => ({ start: b.startMinute, end: b.endMinute }));

  for (const closure of schedule.closures) {
    if (key < closure.startsOn || key > closure.endsOn) continue;
    if (closure.startMinute === null || closure.endMinute === null) continue;
    blocks.push({ start: closure.startMinute, end: closure.endMinute });
  }
  return blocks;
}

export function durationFor(schedule: Schedule, service: ServiceType, fallback: number) {
  return schedule.serviceDurations[service] ?? fallback;
}

export function earliestBookableDay(schedule: Schedule, now = new Date()) {
  const earliest = new Date(now.getTime() + schedule.minLeadMinutes * 60_000);
  return dayKey(earliest);
}

export function latestBookableDay(schedule: Schedule, now = new Date()) {
  return addDays(dayKey(now), schedule.maxLeadDays);
}

/**
 * Why a proposed time cannot be booked, or null if it can.
 *
 * `allowSameDay` exists for walk-ins: someone standing at the desk is not
 * subject to a lead time meant for booking ahead.
 */
export function checkAvailability(
  schedule: Schedule,
  scheduledAt: Date,
  durationMinutes: number,
  startMinute: number,
  options: { now?: Date; allowSameDay?: boolean } = {},
): string | null {
  const now = options.now ?? new Date();
  const key = dayKey(scheduledAt);

  if (!options.allowSameDay) {
    const earliest = earliestBookableDay(schedule, now);
    if (key < earliest) {
      return `Bookings need ${describeLead(schedule.minLeadMinutes)} notice — the earliest date is ${earliest}.`;
    }
  } else if (key < dayKey(now)) {
    return "That date has already passed.";
  } else if (key === dayKey(now) && startMinute + durationMinutes <= minuteOfDay(now)) {
    // Lifting the lead time opens today; it does not open this morning. A slot
    // the clock has already run past cannot be where someone standing at the
    // desk is seen. One still in progress is fine — that is where they are.
    return `That slot ended at ${label(startMinute + durationMinutes)}. Choose a later one.`;
  }

  if (key > latestBookableDay(schedule, now)) {
    return `That is further ahead than the clinic books (${schedule.maxLeadDays} days).`;
  }

  return scheduleConflict(schedule, key, startMinute, durationMinutes);
}

/**
 * Why the clinic's own calendar rules this slot out, or null if they don't.
 *
 * Only the calendar: closures, opening hours, breaks. The booking window —
 * lead time, how far ahead — is about when something may be *booked*, and says
 * nothing about a visit already in the diary. That is what lets the schedule
 * page ask which existing bookings a change has stranded, with the same rules
 * booking enforces rather than a second copy of them.
 */
export function scheduleConflict(
  schedule: Schedule,
  key: string,
  startMinute: number,
  durationMinutes: number,
): string | null {
  const closure = fullDayClosure(schedule, key);
  if (closure) return `The clinic is closed that day — ${closure.reason}.`;

  const hours = hoursFor(schedule, key);
  if (!hours) return "The clinic does not open on that day.";

  if (startMinute < hours.openMinute) {
    return `The clinic opens at ${label(hours.openMinute)}. Choose a later time.`;
  }
  if (startMinute + durationMinutes > hours.closeMinute) {
    return `A ${durationMinutes}-minute visit starting then would run past the ${label(hours.closeMinute)} closing time.`;
  }

  const blocked = blockedIntervals(schedule, key);
  if (overlaps(startMinute, durationMinutes, blocked)) {
    const hit = blocked.find((b) => startMinute < b.end && startMinute + durationMinutes > b.start)!;
    return `That runs into a blocked period (${label(hit.start)} to ${label(hit.end)}).`;
  }

  return null;
}

function describeLead(minutes: number) {
  if (minutes === 0) return "no";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? "a day's" : `${days} days'`;
  }
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "an hour's" : `${hours} hours'`;
}

function label(m: number) {
  const h24 = Math.floor(m / 60);
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

/** "Monday to Saturday, 8:00 AM to 5:00 PM" — the clinic's week, in words. */
export function describeWeek(schedule: Schedule) {
  if (schedule.hours.length === 0) return "No opening hours set";

  const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days = [...schedule.hours].sort((a, b) => a.weekday - b.weekday);

  // Contiguous weekdays sharing the same hours read as a range; anything else
  // is listed, so an unusual week is described accurately rather than tidily.
  const sameHours = days.every(
    (d) => d.openMinute === days[0].openMinute && d.closeMinute === days[0].closeMinute,
  );
  const contiguous = days.every((d, i) => i === 0 || d.weekday === days[i - 1].weekday + 1);

  const when = `${label(days[0].openMinute)} to ${label(days[0].closeMinute)}`;
  if (sameHours && contiguous && days.length > 1) {
    return `${NAMES[days[0].weekday]} to ${NAMES[days[days.length - 1].weekday]}, ${when}`;
  }
  if (sameHours) return `${days.map((d) => NAMES[d.weekday]).join(", ")}, ${when}`;
  return days
    .map((d) => `${NAMES[d.weekday]} ${label(d.openMinute)}–${label(d.closeMinute)}`)
    .join("; ");
}
