import "server-only";
import { revalidatePath } from "next/cache";
import { db, orm } from "@/src/prisma/db";
import type { CurrentPatient } from "@/lib/auth";
import { confirmByEmail, findClash, lockDoctorSchedule, type Actor } from "@/lib/booking";
import { lastDoctorFor, pickDoctor } from "@/lib/clinic";
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
  /** Which doctor it is for. Left out: the one the patient saw last, or the only one. */
  doctorId?: string;
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

  // A request goes to the doctor it names. Every doctor at a clinic is equal:
  // there is no "the clinic's doctor" (plans/group-practice-findings.md).
  const { doctorId, doctors } = await pickDoctor(
    patient.clinicId,
    input.doctorId,
    await lastDoctorFor(patient.clinicId, patient.patientId),
  );
  if (doctors.length === 0) return { ok: false, message: "This clinic is not taking requests at the moment." };
  if (!doctorId) return { ok: false, message: "Choose which doctor you'd like to see.", fieldErrors: { doctorId: ["Required"] } };

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

/** Staff declining a request, with a reason the patient will read. False when there is no open request to decline. */
export async function declineAppointmentRequest(actor: Actor, requestId: string, note: string): Promise<boolean> {
  if (!requestId) return false;

  const request = await orm.AppointmentRequest
    .select("id", "status", "doctorId")
    .where((r) => r.id.eq(requestId))
    .where((r) => r.clinicId.eq(actor.clinicId))
    .first();
  if (!request || request.status !== "PENDING") return false;
  // The desk answers any request; a doctor only their own.
  if (actor.doctorId && request.doctorId !== actor.doctorId) return false;

  const now = instantToDb(new Date());
  await orm.AppointmentRequest.where((r) => r.id.eq(requestId)).update({
    status: "DECLINED",
    decisionNote: note.trim() || null,
    decidedById: actor.accountId,
    decidedAt: now,
    updatedAt: now,
  });

  revalidatePath("/desk/requests");
  revalidatePath("/portal");
  return true;
}

export type AcceptResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "needs-time" }
  | { ok: false; reason: "refused"; message: string };

/**
 * Staff accepting a request, which is the moment a slot is actually taken.
 *
 * Because nothing was held, this can fail: the time may have gone while the
 * request sat waiting. That is not an edge case to be papered over — it is the
 * direct consequence of requests not reserving, and the clinic is told plainly
 * so it can offer another time. `time` (HH:MM) overrides the patient's
 * preference, and is required when they asked for "any time".
 */
export async function acceptAppointmentRequest(actor: Actor, requestId: string, time: string): Promise<AcceptResult> {
  if (!requestId) return { ok: false, reason: "not-found" };

  const request = await orm.AppointmentRequest
    .select("id", "status", "patientId", "doctorId", "preferredDate", "preferredTime", "service", "reason")
    .include("patient", (p) => p.select("reminderPreference"))
    .where((r) => r.id.eq(requestId))
    .where((r) => r.clinicId.eq(actor.clinicId))
    .first();
  if (!request || request.status !== "PENDING") return { ok: false, reason: "not-found" };
  // The desk answers any request; a doctor only their own.
  if (actor.doctorId && request.doctorId !== actor.doctorId) return { ok: false, reason: "not-found" };

  const chosen = time.trim() || request.preferredTime;
  if (!chosen || !/^([01]\d|2[0-3]):[0-5]\d$/.test(chosen)) return { ok: false, reason: "needs-time" };

  const schedule = await loadSchedule(request.doctorId);
  const duration = durationFor(schedule, request.service, SERVICE_MINUTES[request.service]);
  const at = fromDateTimeLocalValue(`${request.preferredDate}T${chosen}`);
  if (!at) return { ok: false, reason: "needs-time" };

  const problem = checkAvailability(schedule, at, duration, minuteOfDay(at));
  if (problem) return { ok: false, reason: "refused", message: problem };

  const now = instantToDb(new Date());

  // The same lock and overlap check every other booking goes through.
  const outcome = await db.transaction(async (tx) => {
    await lockDoctorSchedule(tx, request.doctorId);
    if (await findClash(tx, request.doctorId, at, duration)) return { taken: true as const, created: null };

    const created = await tx.orm.public.Appointment.select("id").create({
      id: newId(),
      clinicId: actor.clinicId,
      patientId: request.patientId,
      doctorId: request.doctorId,
      bookedById: actor.accountId,
      scheduledAt: instantToDb(at),
      durationMinutes: duration,
      service: request.service,
      reason: request.reason,
      status: "CONFIRMED",
      source: "PATIENT_PORTAL",
      visitType: "IN_PERSON",
      priority: "ROUTINE",
      // The patient asked for this visit themselves, so their standing choice
      // about hearing from the clinic is the only signal there is.
      reminderPreference: request.patient.reminderPreference,
      createdAt: now,
      updatedAt: now,
    });

    await tx.orm.public.AppointmentRequest.where((r) => r.id.eq(requestId)).update({
      status: "ACCEPTED",
      appointmentId: created.id,
      decidedById: actor.accountId,
      decidedAt: now,
      updatedAt: now,
    });

    return { taken: false as const, created };
  });

  if (outcome.taken) {
    return { ok: false, reason: "refused", message: "That time went while the request was waiting. Offer another." };
  }

  // The patient asked for this one, so they are told it came through — on
  // the same terms as any other booking.
  await confirmByEmail(outcome.created.id);

  revalidatePath("/desk/requests");
  revalidatePath("/desk/appointments");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  return { ok: true, appointmentId: outcome.created.id };
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
