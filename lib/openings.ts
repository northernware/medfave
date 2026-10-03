import "server-only";
import { orm } from "@/src/prisma/db";
import { durationFor, earliestBookableDay, latestBookableDay } from "./availability";
import { dayKey, instantFromDb, instantToDb, startOfClinicDay } from "./datetime";
import { SERVICE_MINUTES } from "./domain";
import type { ServiceType } from "./enums";
import { heldSlots } from "./held-slots";
import { loadSchedule } from "./queries";
import { addDays, minuteOfDay, occupiesSlot, slotsForDay, type BusyInterval } from "./scheduling";

export type Opening = { date: string; time: string };

/**
 * Start times a patient could ask for that are really free: inside the
 * doctor's hours and booking window, clear of breaks and closures, of booked
 * visits, and of times other patients have already asked for. Times only,
 * never whose visit fills the rest.
 *
 * A request is still a request (decision 2): these keep patients from asking
 * for a taken time, they don't book anything.
 */
export async function openingsFor(
  doctorId: string,
  /** One kind of visit, or several seen back to back (one each, in order): the whole run has to fit. */
  services: ServiceType | ServiceType[],
  options: {
    /** One day's free times, in full: the request form's time chips. */
    date?: string;
    /** Without `date`: the next few, at most `perDay` a day, spread through it. */
    limit?: number;
    perDay?: number;
    now?: Date;
  } = {},
) {
  const now = options.now ?? new Date();
  const schedule = await loadSchedule(doctorId);
  const minutes = [services]
    .flat()
    .reduce((sum, s) => sum + durationFor(schedule, s, SERVICE_MINUTES[s]), 0);
  const window = { earliest: earliestBookableDay(schedule, now), latest: latestBookableDay(schedule, now) };
  const first = options.date ?? window.earliest;
  const last = options.date ?? window.latest;
  if (first > last || first > window.latest || last < window.earliest) return { minutes, openings: [] as Opening[] };

  const [booked, asked] = await Promise.all([
    orm.Appointment
      .select("scheduledAt", "durationMinutes", "status")
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.scheduledAt.gte(instantToDb(startOfClinicDay(first))))
      .where((a) => a.scheduledAt.lt(instantToDb(startOfClinicDay(addDays(last, 1)))))
      .all(),
    orm.AppointmentRequest
      .select("preferredDate", "preferredTime", "service")
      .where((r) => r.doctorId.eq(doctorId))
      .where((r) => r.status.eq("PENDING"))
      .where((r) => r.preferredDate.gte(first))
      .where((r) => r.preferredDate.lte(last))
      .all(),
  ]);

  const busy: Record<string, BusyInterval[]> = {};
  for (const a of booked) {
    if (!occupiesSlot(a.status)) continue;
    const at = instantFromDb(a.scheduledAt);
    const start = minuteOfDay(at);
    (busy[dayKey(at)] ??= []).push({ start, end: start + a.durationMinutes });
  }
  // An early check-in still holds its old time, until the consultation starts.
  for (const h of await heldSlots(doctorId, startOfClinicDay(first), startOfClinicDay(addDays(last, 1)))) {
    const start = minuteOfDay(h.scheduledAt);
    (busy[dayKey(h.scheduledAt)] ??= []).push({ start, end: start + h.durationMinutes });
  }
  // A time somebody has asked for is spoken for until the clinic answers.
  for (const r of asked) {
    if (!r.preferredTime) continue;
    const [h, m] = r.preferredTime.split(":").map(Number);
    const start = h * 60 + m;
    const length = durationFor(schedule, r.service as ServiceType, SERVICE_MINUTES[r.service as ServiceType]);
    (busy[String(r.preferredDate).slice(0, 10)] ??= []).push({ start, end: start + length });
  }

  const clock = { key: dayKey(now), minute: minuteOfDay(now) };
  const openings: Opening[] = [];
  const limit = options.date ? Infinity : (options.limit ?? 6);
  const perDay = options.date ? Infinity : (options.perDay ?? 2);
  // Two offered on one day sit at least this far apart: a morning and an afternoon, not 9:00 and 9:30.
  const spread = options.date ? 0 : 150;

  for (let key = first; key <= last && openings.length < limit; key = addDays(key, 1)) {
    let taken = 0;
    let lastMinute = -Infinity;
    for (const slot of slotsForDay(key, minutes, busy[key] ?? [], window, schedule, clock)) {
      if (!slot.free || slot.minute - lastMinute < spread) continue;
      openings.push({ date: key, time: slot.value });
      lastMinute = slot.minute;
      if (++taken >= perDay || openings.length >= limit) break;
    }
  }
  return { minutes, openings };
}
