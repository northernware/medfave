import "server-only";
import { revalidatePath } from "next/cache";
import { orm } from "@/src/prisma/db";
import type { CurrentPatient } from "@/lib/auth";
import { clinicDoctorId } from "@/lib/clinic";
import {
  calendarDateToDb,
  fromDateInputValue,
  fromDateTimeLocalValue,
  instantToDb,
} from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { ServiceType } from "@/lib/enums";
import { SERVICE_MINUTES } from "@/lib/domain";
import { checkAvailability, durationFor } from "@/lib/availability";
import { minuteOfDay } from "@/lib/scheduling";
import { loadSchedule } from "@/lib/queries";
import type { FormState } from "@/lib/validation";

/*
 * A patient's appointment requests, shared by the portal's forms and the app's
 * API. Each function is given the patient it acts for — already checked by the
 * caller's own gate — and never takes a patient id from the request.
 */

export type RequestInput = {
  service: string;
  /** YYYY-MM-DD */
  preferredDate: string;
  /** HH:MM, or empty for "any time". */
  preferredTime: string;
  reason: string;
};

export type CreateRequestResult = { ok: true; id: string } | ({ ok: false } & FormState);

/**
 * A patient asking for a time.
 *
 * The request holds no slot. That is the rule, and it is structural rather
 * than remembered: a request is its own row and never touches the appointment
 * table, so there is nothing for it to reserve. Letting a wish block the
 * calendar would let anybody empty it, and a clinic cannot tell a genuine
 * request from a mischievous one at the moment it arrives.
 *
 * The consequence is stated plainly to the patient: asking is not booking, and
 * the time can go to somebody else before the clinic answers.
 */
export async function createAppointmentRequest(
  patient: CurrentPatient,
  input: RequestInput,
): Promise<CreateRequestResult> {
  const rawService = input.service;
  const preferredDate = input.preferredDate.trim();
  const preferredTime = input.preferredTime.trim();
  const reason = input.reason.trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!(rawService in ServiceType)) fieldErrors.service = ["Choose what the visit is for"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) fieldErrors.preferredDate = ["Choose a date"];
  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
    fieldErrors.preferredTime = ["Use a time like 09:30, or leave it blank"];
  }
  if (!reason) fieldErrors.reason = ["Say briefly what it is about"];
  if (reason.length > 500) fieldErrors.reason = ["Keep it under 500 characters"];
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the details of your request.", fieldErrors };
  }

  const doctorId = await clinicDoctorId(patient.clinicId);
  if (!doctorId) return { ok: false, message: "This clinic is not taking requests at the moment." };

  // The login outlives an archived chart on purpose, but a request would land in
  // the desk's queue for somebody the desk cannot find. Asked to ring instead.
  const chart = await orm.Patient
    .select("archivedAt")
    .where((p) => p.id.eq(patient.patientId))
    .first();
  if (chart?.archivedAt) {
    return { ok: false, message: "Your record at this clinic is closed. Please contact the clinic to book." };
  }

  // The clinic's own rules apply to a request as much as to a booking: asking
  // for a Sunday, or for a date beyond how far ahead the clinic books, is
  // something to say now rather than after somebody has read it.
  const schedule = await loadSchedule(doctorId);
  const service = rawService as ServiceType;
  const at = fromDateTimeLocalValue(`${preferredDate}T${preferredTime || "09:00"}`);
  if (!at) return { ok: false, message: "Check the date.", fieldErrors: { preferredDate: ["Invalid date"] } };

  const problem = checkAvailability(
    schedule,
    at,
    durationFor(schedule, service, SERVICE_MINUTES[service]),
    minuteOfDay(at),
  );
  if (problem) {
    return { ok: false, message: problem, fieldErrors: { preferredDate: [problem] } };
  }

  const now = instantToDb(new Date());
  const day = fromDateInputValue(preferredDate);
  if (!day) return { ok: false, message: "Check the date.", fieldErrors: { preferredDate: ["Invalid date"] } };

  const id = newId();
  await orm.AppointmentRequest.create({
    id,
    clinicId: patient.clinicId,
    patientId: patient.patientId,
    doctorId,
    requestedById: patient.accountId,
    preferredDate: calendarDateToDb(day),
    preferredTime: preferredTime || null,
    service,
    reason,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/portal");
  revalidatePath("/desk/requests");
  return { ok: true, id };
}

/**
 * A patient changing their mind before the clinic has answered. False when
 * there is nothing of theirs to withdraw: not found, not theirs, or already
 * answered.
 */
export async function withdrawAppointmentRequest(patient: CurrentPatient, requestId: string): Promise<boolean> {
  if (!requestId) return false;

  const own = await orm.AppointmentRequest
    .select("id", "status")
    .where((r) => r.id.eq(requestId))
    // Scoped to this patient's own row, not merely to the clinic: one patient
    // must never be able to touch another's request.
    .where((r) => r.patientId.eq(patient.patientId))
    .first();
  if (!own || own.status !== "PENDING") return false;

  await orm.AppointmentRequest.where((r) => r.id.eq(requestId)).update({
    status: "WITHDRAWN",
    updatedAt: instantToDb(new Date()),
  });
  revalidatePath("/portal");
  revalidatePath("/desk/requests");
  return true;
}
