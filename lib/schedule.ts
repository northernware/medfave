import "server-only";
import { db, orm } from "@/src/prisma/db";
import { newId } from "@/lib/ids";
import { SERVICES } from "@/lib/domain";
import type { FormState } from "@/lib/validation";

/*
 * A doctor's breaks, closures and visit lengths, shared by the web's schedule
 * page (app/actions/schedule.ts) and the app's API. Each writer returns null
 * when it saved, or what to fix. Whose diary it is has been settled by the
 * caller.
 */

/** "08:30" as minutes since midnight, on a five-minute boundary; null otherwise. */
function minuteOf(value: FormDataEntryValue | null): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const minute = Number(m[1]) * 60 + Number(m[2]);
  return minute % 5 === 0 ? minute : null;
}

/** A recurring break: lunch, rounds. Null when written, or what to fix. */
export async function addBreakFor(doctorId: string, formData: FormData): Promise<FormState | null> {
  const label = String(formData.get("label") ?? "").trim();
  const rawDay = String(formData.get("weekday") ?? "");
  const weekday = rawDay === "" ? null : Number(rawDay);
  const from = minuteOf(formData.get("from"));
  const to = minuteOf(formData.get("to"));

  const fieldErrors: Record<string, string[]> = {};
  if (!label) fieldErrors.label = ["Name it — lunch, rounds, a meeting"];
  if (label.length > 60) fieldErrors.label = ["Keep it under 60 characters"];
  if (weekday !== null && !(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) {
    fieldErrors.weekday = ["Choose a day"];
  }
  if (from === null) fieldErrors.from = ["A time in steps of five minutes"];
  if (to === null) fieldErrors.to = ["A time in steps of five minutes"];
  if (from !== null && to !== null && to <= from) fieldErrors.to = ["Has to end after it starts"];
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the break.", fieldErrors };

  await orm.ClinicBreak.create({
    id: newId(),
    doctorId,
    weekday,
    startMinute: from!,
    endMinute: to!,
    label,
  });
  return null;
}

/** Removes one of this doctor's breaks; false if it isn't theirs. */
export async function removeBreakFor(doctorId: string, id: string): Promise<boolean> {
  const row = await orm.ClinicBreak
    .select("id")
    .where((b) => b.id.eq(id))
    .where((b) => b.doctorId.eq(doctorId))
    .first();
  if (!row) return false;
  await orm.ClinicBreak.where((b) => b.id.eq(id)).delete();
  return true;
}

/** How long a repeating closure may last, so one repeat ends before the next begins. */
const REPEAT_LIMIT: Record<string, number> = { NONE: Infinity, WEEKLY: 6, MONTHLY: 27, YEARLY: 364 };

/**
 * A day or a run of days off, or part of one, once or repeating weekly,
 * monthly or yearly.
 *
 * Both times or neither: a closure with only a start is not a period, and
 * guessing where it ends would close the clinic for longer than anyone said.
 */
export async function addClosureFor(doctorId: string, formData: FormData): Promise<FormState | null> {
  const reason = String(formData.get("reason") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim() || startsOn;
  const rawFrom = String(formData.get("from") ?? "").trim();
  const rawTo = String(formData.get("to") ?? "").trim();
  const from = rawFrom ? minuteOf(rawFrom) : null;
  const to = rawTo ? minuteOf(rawTo) : null;
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const repeat = String(formData.get("repeat") ?? "").trim() || "NONE";

  const fieldErrors: Record<string, string[]> = {};
  if (!reason) fieldErrors.reason = ["Say why — it is shown to anybody who tries to book"];
  if (reason.length > 120) fieldErrors.reason = ["Keep it under 120 characters"];
  if (!isDate(startsOn)) fieldErrors.startsOn = ["Choose the first day"];
  if (!isDate(endsOn)) fieldErrors.endsOn = ["Choose the last day"];
  if (isDate(startsOn) && isDate(endsOn) && endsOn < startsOn) {
    fieldErrors.endsOn = ["Cannot end before it starts"];
  }
  if (!(repeat in REPEAT_LIMIT)) {
    fieldErrors.repeat = ["Choose how it repeats"];
  } else if (repeat !== "NONE" && isDate(startsOn) && isDate(endsOn)) {
    // A repeat can't overlap the next one: a week off can't repeat weekly.
    const span = (Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 + 1;
    if (span > REPEAT_LIMIT[repeat]) fieldErrors.endsOn = [`Too long to repeat ${repeat.toLowerCase()} — at most ${REPEAT_LIMIT[repeat]} days`];
  }
  if (Boolean(rawFrom) !== Boolean(rawTo)) {
    fieldErrors[rawFrom ? "to" : "from"] = ["Give both times, or neither for the whole day"];
  } else if (rawFrom) {
    if (from === null) fieldErrors.from = ["A time in steps of five minutes"];
    if (to === null) fieldErrors.to = ["A time in steps of five minutes"];
    if (from !== null && to !== null && to <= from) fieldErrors.to = ["Has to end after it starts"];
  }
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the closure.", fieldErrors };

  await orm.ClinicClosure.create({
    id: newId(),
    doctorId,
    startsOn,
    endsOn,
    startMinute: from,
    endMinute: to,
    reason,
    repeat,
  });
  return null;
}

/** Removes one of this doctor's closures; false if it isn't theirs. */
export async function removeClosureFor(doctorId: string, id: string): Promise<boolean> {
  const row = await orm.ClinicClosure
    .select("id")
    .where((c) => c.id.eq(id))
    .where((c) => c.doctorId.eq(doctorId))
    .first();
  if (!row) return false;
  await orm.ClinicClosure.where((c) => c.id.eq(id)).delete();
  return true;
}

/**
 * How long each kind of visit takes here.
 *
 * Only a difference from the built-in length is stored: a blank field, or the
 * built-in number typed back in, removes the override. That keeps "what the
 * clinic changed" visible as exactly the rows that exist.
 */
export async function saveServiceLengthsFor(doctorId: string, formData: FormData): Promise<FormState | null> {
  const fieldErrors: Record<string, string[]> = {};
  const wanted = new Map<string, number | null>();
  for (const service of SERVICES) {
    const raw = String(formData.get(`minutes-${service.value}`) ?? "").trim();
    if (!raw) {
      wanted.set(service.value, null);
      continue;
    }
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240 || minutes % 5 !== 0) {
      fieldErrors[`minutes-${service.value}`] = ["5 to 240, in fives"];
      continue;
    }
    wanted.set(service.value, minutes === service.minutes ? null : minutes);
  }
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the highlighted lengths.", fieldErrors };

  const existing = await orm.ServiceDuration
    .select("id", "service", "minutes")
    .where((d) => d.doctorId.eq(doctorId))
    .all();

  await db.transaction(async (tx) => {
    const t = tx.orm.public;
    for (const service of SERVICES) {
      const want = wanted.get(service.value) ?? null;
      const row = existing.find((e) => e.service === service.value);
      if (want === null && row) {
        await t.ServiceDuration.where((d) => d.id.eq(row.id)).delete();
      } else if (want !== null && row && row.minutes !== want) {
        await t.ServiceDuration.where((d) => d.id.eq(row.id)).update({ minutes: want });
      } else if (want !== null && !row) {
        await t.ServiceDuration.create({ id: newId(), doctorId, service: service.value, minutes: want });
      }
    }
  });
  return null;
}

/** Whether this doctor is closed on Philippine holidays (on unless turned off). */
export async function setObserveHolidays(doctorId: string, observe: boolean): Promise<void> {
  const row = await orm.ScheduleSettings.select("doctorId").where((s) => s.doctorId.eq(doctorId)).first();
  if (row) {
    await orm.ScheduleSettings.where((s) => s.doctorId.eq(doctorId)).update({ observeHolidays: observe });
  } else {
    await orm.ScheduleSettings.create({ doctorId, observeHolidays: observe });
  }
}

export async function observesHolidays(doctorId: string): Promise<boolean> {
  const row = await orm.ScheduleSettings.select("observeHolidays").where((s) => s.doctorId.eq(doctorId)).first();
  return row?.observeHolidays ?? true;
}
