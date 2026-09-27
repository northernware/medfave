/**
 * The choices the schedule page offers, shared by the form and the action that
 * checks them — so the list a person picks from and the list the server accepts
 * cannot drift apart.
 */

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** How finely the day is cut into bookable start times. */
export const SLOT_STEPS = [5, 10, 15, 20, 30, 60];

/** Minimum notice for a booking, in minutes. Zero opens same-day booking. */
export const NOTICE_OPTIONS = [0, 60, 120, 240, 720, 1440, 2880, 4320, 10080];

export function describeNotice(minutes: number) {
  if (minutes === 0) return "None — same day";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 7 ? "One week" : `${days} day${days === 1 ? "" : "s"}`;
  }
  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** "08:30" from minutes since midnight, for a time input's value. */
export function timeValue(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
