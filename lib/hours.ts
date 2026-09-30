import "server-only";
import { db } from "@/src/prisma/db";
import { label } from "@/lib/availability";
import { newId } from "@/lib/ids";
import { loadClinicHours, type DayHours } from "@/lib/queries";
import type { FormState } from "@/lib/validation";

/*
 * Saving a week of hours — a doctor's, or the clinic's — shared by the web's
 * schedule page (app/actions/schedule.ts) and the app's API
 * (app/api/v1/doctor/hours). Input is the web form's encoding: open-<weekday>
 * = "on", from-<weekday> / to-<weekday> = "HH:MM".
 */

/** "08:30" as minutes since midnight, on a five-minute boundary; null otherwise. */
export function minuteOf(value: FormDataEntryValue | null): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const minute = Number(m[1]) * 60 + Number(m[2]);
  return minute % 5 === 0 ? minute : null;
}

/** The week form's days: the open ones, or the per-day problems. */
export function readWeek(formData: FormData): { open: DayHours[]; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  const open: DayHours[] = [];

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
  return { open, fieldErrors };
}

export const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** A doctor's week, replaced whole, kept inside the clinic's hours. Null when saved. */
export async function writeDoctorWeek(clinicId: string, doctorId: string, formData: FormData): Promise<FormState | null> {
  const { open, fieldErrors } = readWeek(formData);

  // A doctor's hours sit inside the clinic's, when the clinic has set them.
  const clinicWeek = await loadClinicHours(clinicId);
  if (clinicWeek.length > 0) {
    for (const day of open) {
      const c = clinicWeek.find((x) => x.weekday === day.weekday);
      if (!c) {
        fieldErrors[`day-${day.weekday}`] = [`The clinic is closed on ${DAY_NAMES[day.weekday]}`];
      } else if (day.openMinute < c.openMinute || day.closeMinute > c.closeMinute) {
        fieldErrors[`day-${day.weekday}`] = [
          `The clinic is open ${label(c.openMinute)}–${label(c.closeMinute)} on ${DAY_NAMES[day.weekday]}`,
        ];
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the highlighted days.", fieldErrors };
  if (open.length === 0) return { message: "Open on at least one day. To close for a period, add a closure." };

  await db.transaction(async (tx) => {
    // Replaced as a whole; `.delete()` on the ORM removes a single row.
    const clear = tx.sql.public.ClinicHours.delete().where((f, fns) => fns.eq(f.doctorId, doctorId)).build();
    await tx.execute(clear as never);
    for (const day of open) await tx.orm.public.ClinicHours.create({ id: newId(), doctorId, ...day });
  });
  return null;
}

/** The clinic's own week, replaced whole. Doctors' hours are trimmed to it where offered. Null when saved. */
export async function writeClinicWeek(clinicId: string, formData: FormData): Promise<FormState | null> {
  const { open, fieldErrors } = readWeek(formData);
  if (Object.keys(fieldErrors).length > 0) return { message: "Check the highlighted days.", fieldErrors };
  if (open.length === 0) return { message: "Open on at least one day. To close for a period, add a closure." };
  await db.transaction(async (tx) => {
    const clear = tx.sql.public.ClinicOpeningHours.delete().where((f, fns) => fns.eq(f.clinicId, clinicId)).build();
    await tx.execute(clear as never);
    for (const day of open) await tx.orm.public.ClinicOpeningHours.create({ id: newId(), clinicId, ...day });
  });
  return null;
}

export type { DayHours };
