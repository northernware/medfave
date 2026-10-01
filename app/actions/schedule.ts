"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { requireClinicManager } from "@/lib/auth";
import { pickDoctor } from "@/lib/clinic";
import { writeClinicWeek, writeDoctorWeek } from "@/lib/hours";
import {
  addBreakFor,
  addClosureFor,
  removeBreakFor,
  removeClosureFor,
  saveServiceLengthsFor,
  setObserveHolidays,
} from "@/lib/schedule";
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

// --- opening hours -------------------------------------------------------------

/**
 * The week, replaced whole.
 *
 * At least one day has to be open. A clinic with no hours rows at all falls back
 * to the built-in week, so "closed every day" would save as its opposite — and
 * a clinic that never opens is not a setting anybody means.
 */

export async function saveOpeningHours(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { manager, doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;
  const problem = await writeDoctorWeek(manager.clinicId, doctorId, formData);
  if (problem) return problem;
  done("hours", doctorId);
}

// --- recurring breaks ---------------------------------------------------------

export async function addBreak(forDoctor: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return NO_CLINICIAN;
  const problem = await addBreakFor(doctorId, formData);
  if (problem) return problem;
  done("breaks", doctorId);
}

export async function removeBreak(forDoctor: string, formData: FormData) {
  const { doctorId } = await scope(forDoctor);
  const id = String(formData.get("breakId") ?? "");
  if (!doctorId || !id) return;
  if (await removeBreakFor(doctorId, id)) done("breaks", doctorId);
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
  const problem = await addClosureFor(doctorId, formData);
  if (problem) return problem;
  done("closures", doctorId);
}

export async function removeClosure(forDoctor: string, formData: FormData) {
  const { doctorId } = await scope(forDoctor);
  const id = String(formData.get("closureId") ?? "");
  if (!doctorId || !id) return;
  if (await removeClosureFor(doctorId, id)) done("closures", doctorId);
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
  const problem = await saveServiceLengthsFor(doctorId, formData);
  if (problem) return problem;
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

// --- the clinic's own opening hours ------------------------------------------

/**
 * When the clinic itself is open, replaced whole. Doctors' hours must sit
 * inside it; any that no longer do are trimmed where bookings are offered
 * (`withinClinicHours`), and the schedule page says whose.
 */
export async function saveClinicHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireClinicManager();
  const problem = await writeClinicWeek(manager.clinicId, formData);
  if (problem) return problem;
  revalidatePath("/manage/schedule");
  revalidatePath("/manage");
  redirect("/manage/schedule?saved=clinic");
}

// --- Philippine holidays -----------------------------------------------------

export async function saveHolidays(forDoctor: string, formData: FormData) {
  const { doctorId } = await scope(forDoctor);
  if (!doctorId) return;
  await setObserveHolidays(doctorId, formData.get("observe") === "on");
  done("holidays", doctorId);
}
