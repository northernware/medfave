"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, orm } from "@/src/prisma/db";
import { requireClinicManager } from "@/lib/auth";
import { pickDoctor } from "@/lib/clinic";
import { newId } from "@/lib/ids";
import { SERVICES } from "@/lib/domain";
import { NOTICE_OPTIONS, SLOT_STEPS } from "@/lib/schedule-options";
import type { FormState } from "@/lib/validation";

/**
 * Writing the clinic's week.
 *
 * The rows stay keyed by clinician, as they always were: booking, the schedule
 * lock and the overlap checks are all per-clinician and correct, and re-keying
 * them would disturb the most safety-critical code in the application for no
 * change in behaviour at a one-doctor clinic. This page presents them as the
 * clinic's hours and writes them for the clinic's clinician. A clinic with
 * several would add a clinician picker here and nowhere else.
 *
 * Nothing here moves a booking. A visit already in the diary on a day that is
 * now closed stays where it is; the schedule page lists every such booking so a
 * person can ring the patient, rather than the system quietly cancelling
 * something a patient is expecting.
 */

const NO_CLINICIAN: FormState = {
  message: "You can only change your own hours, or a doctor of this clinic's.",
};

/**
 * Whose diary a change is for. A doctor sets only their own hours; an
 * administrator sets any of the clinic's doctors'. Every action is bound to a
 * doctor by the page (`action.bind(null, doctorId)`), and this re-checks it.
 */
async function scope(requested: string) {
  const manager = await requireClinicManager();
  if (manager.doctorId) return { manager, doctorId: requested === manager.doctorId ? manager.doctorId : null };
  const { doctorId } = await pickDoctor(manager.clinicId, requested);
  return { manager, doctorId: doctorId === requested ? doctorId : null };
}

function done(section: string, doctorId: string): never {
  revalidatePath("/manage/schedule");
  revalidatePath("/manage");
  redirect(`/manage/schedule?doctor=${encodeURIComponent(doctorId)}&saved=${section}`);
}

/** "08:30" as minutes since midnight, on a five-minute boundary; null otherwise. */
function minuteOf(value: FormDataEntryValue | null): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const minute = Number(m[1]) * 60 + Number(m[2]);
  return minute % 5 === 0 ? minute : null;
}

// --- opening hours -------------------------------------------------------------

/**
 * The week, replaced whole.
 *
 * At least one day has to be open. A clinic with no hours rows at all falls back
 * to the built-in week, so "closed every day" would save as its opposite — and
 * a clinic that never opens is not a setting anybody means.
 */
export async function saveOpeningHours(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;

  const fieldErrors: Record<string, string[]> = {};
  const open: { weekday: number; openMinute: number; closeMinute: number }[] = [];

  for (let weekday = 0; weekday < 7; weekday++) {
    if (formData.get(`open-${weekday}`) !== "on") continue;
    const from = minuteOf(formData.get(`from-${weekday}`));
    const to = minuteOf(formData.get(`to-${weekday}`));
    if (from === null || to === null) {
      fieldErrors[`day-${weekday}`] = ["Give both times, on the hour or in steps of five minutes"];
    } else if (to <= from) {
      fieldErrors[`day-${weekday}`] = ["Closing has to be after opening"];
    } else {
      open.push({ weekday, openMinute: from, closeMinute: to });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Check the highlighted days.", fieldErrors };
  }
  if (open.length === 0) {
    return { message: "Open on at least one day. To close for a period, add a closure below." };
  }

  await db.transaction(async (tx) => {
    // The week is edited as a whole, so it is replaced as a whole. `.delete()`
    // on the ORM removes a single row; these are matched by a non-unique key.
    const clear = tx.sql.public.ClinicHours
      .delete()
      .where((f, fns) => fns.eq(f.doctorId, doctorId))
      .build();
    await tx.execute(clear as never);
    for (const day of open) {
      await tx.orm.public.ClinicHours.create({ id: newId(), doctorId, ...day });
    }
  });

  done("hours", doctorId);
}

// --- recurring breaks ---------------------------------------------------------

export async function addBreak(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;

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
  done("breaks", doctorId);
}

export async function removeBreak(forDoctor: string, formData: FormData) {
  const { doctorId } = await scope(forDoctor);
  const id = String(formData.get("breakId") ?? "");
  if (!doctorId || !id) return;
  const row = await orm.ClinicBreak
    .select("id")
    .where((b) => b.id.eq(id))
    .where((b) => b.doctorId.eq(doctorId))
    .first();
  if (!row) return;
  await orm.ClinicBreak.where((b) => b.id.eq(id)).delete();
  done("breaks", doctorId);
}

// --- one-off closures --------------------------------------------------------

/**
 * A day or a run of days off, or part of one.
 *
 * Both times or neither: a closure with only a start is not a period, and
 * guessing where it ends would close the clinic for longer than anyone said.
 */
export async function addClosure(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;

  const reason = String(formData.get("reason") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim() || startsOn;
  const rawFrom = String(formData.get("from") ?? "").trim();
  const rawTo = String(formData.get("to") ?? "").trim();
  const from = rawFrom ? minuteOf(rawFrom) : null;
  const to = rawTo ? minuteOf(rawTo) : null;
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  const fieldErrors: Record<string, string[]> = {};
  if (!reason) fieldErrors.reason = ["Say why — it is shown to anybody who tries to book"];
  if (reason.length > 120) fieldErrors.reason = ["Keep it under 120 characters"];
  if (!isDate(startsOn)) fieldErrors.startsOn = ["Choose the first day"];
  if (!isDate(endsOn)) fieldErrors.endsOn = ["Choose the last day"];
  if (isDate(startsOn) && isDate(endsOn) && endsOn < startsOn) {
    fieldErrors.endsOn = ["Cannot end before it starts"];
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
  });
  done("closures", doctorId);
}

export async function removeClosure(forDoctor: string, formData: FormData) {
  const { doctorId } = await scope(forDoctor);
  const id = String(formData.get("closureId") ?? "");
  if (!doctorId || !id) return;
  const row = await orm.ClinicClosure
    .select("id")
    .where((c) => c.id.eq(id))
    .where((c) => c.doctorId.eq(doctorId))
    .first();
  if (!row) return;
  await orm.ClinicClosure.where((c) => c.id.eq(id)).delete();
  done("closures", doctorId);
}

// --- service lengths --------------------------------------------------------------

/**
 * How long each kind of visit takes here.
 *
 * Only a difference from the built-in length is stored: a blank field, or the
 * built-in number typed back in, removes the override. That keeps "what the
 * clinic changed" visible as exactly the rows that exist.
 */
export async function saveServiceLengths(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;

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
  done("lengths", doctorId);
}

// --- booking rules ------------------------------------------------------------------

export async function saveBookingRules(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;

  const slotStepMinutes = Number(formData.get("slotStepMinutes"));
  const minLeadMinutes = Number(formData.get("minLeadMinutes"));
  const maxLeadDays = Number(formData.get("maxLeadDays"));

  const fieldErrors: Record<string, string[]> = {};
  if (!SLOT_STEPS.includes(slotStepMinutes)) fieldErrors.slotStepMinutes = ["Choose a step"];
  if (!NOTICE_OPTIONS.includes(minLeadMinutes)) fieldErrors.minLeadMinutes = ["Choose how much notice"];
  if (!Number.isInteger(maxLeadDays) || maxLeadDays < 1 || maxLeadDays > 365) {
    fieldErrors.maxLeadDays = ["Between 1 and 365 days"];
  } else if (maxLeadDays * 24 * 60 <= minLeadMinutes) {
    fieldErrors.maxLeadDays = ["Has to reach past the notice period, or nothing is bookable"];
  }
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the booking rules.", fieldErrors };

  const existing = await orm.ScheduleSettings
    .select("doctorId")
    .where((s) => s.doctorId.eq(doctorId))
    .first();
  if (existing) {
    await orm.ScheduleSettings
      .where((s) => s.doctorId.eq(doctorId))
      .update({ slotStepMinutes, minLeadMinutes, maxLeadDays });
  } else {
    await orm.ScheduleSettings.create({ doctorId, slotStepMinutes, minLeadMinutes, maxLeadDays });
  }
  done("rules", doctorId);
}
