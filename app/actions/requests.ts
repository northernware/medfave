"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, orm } from "@/src/prisma/db";
import { requirePatientAccount, requireStaff } from "@/lib/auth";
import { clinicDoctorId } from "@/lib/clinic";
import {
  calendarDateToDb,
  formatDateTime,
  fromDateInputValue,
  fromDateTimeLocalValue,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import { appUrl, sendAppointmentConfirmation } from "@/lib/email";
import { newId } from "@/lib/ids";
import { ServiceType } from "@/lib/enums";
import { SERVICE_MINUTES } from "@/lib/domain";
import { checkAvailability, durationFor } from "@/lib/availability";
import { minuteOfDay } from "@/lib/scheduling";
import { loadSchedule } from "@/lib/queries";
import type { FormState } from "@/lib/validation";

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
export async function requestAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const patient = await requirePatientAccount();

  const rawService = String(formData.get("service") ?? "");
  const preferredDate = String(formData.get("preferredDate") ?? "").trim();
  const preferredTime = String(formData.get("preferredTime") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!(rawService in ServiceType)) fieldErrors.service = ["Choose what the visit is for"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) fieldErrors.preferredDate = ["Choose a date"];
  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) {
    fieldErrors.preferredTime = ["Use a time like 09:30, or leave it blank"];
  }
  if (!reason) fieldErrors.reason = ["Say briefly what it is about"];
  if (reason.length > 500) fieldErrors.reason = ["Keep it under 500 characters"];
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "Check the details of your request.", fieldErrors };
  }

  const doctorId = await clinicDoctorId(patient.clinicId);
  if (!doctorId) return { message: "This clinic is not taking requests at the moment." };

  // The clinic's own rules apply to a request as much as to a booking: asking
  // for a Sunday, or for a date beyond how far ahead the clinic books, is
  // something to say now rather than after somebody has read it.
  const schedule = await loadSchedule(doctorId);
  const service = rawService as ServiceType;
  const at = fromDateTimeLocalValue(`${preferredDate}T${preferredTime || "09:00"}`);
  if (!at) return { message: "Check the date.", fieldErrors: { preferredDate: ["Invalid date"] } };

  const problem = checkAvailability(
    schedule,
    at,
    durationFor(schedule, service, SERVICE_MINUTES[service]),
    minuteOfDay(at),
  );
  if (problem) {
    return { message: problem, fieldErrors: { preferredDate: [problem] } };
  }

  const now = instantToDb(new Date());
  const day = fromDateInputValue(preferredDate);
  if (!day) return { message: "Check the date.", fieldErrors: { preferredDate: ["Invalid date"] } };

  await orm.AppointmentRequest.create({
    id: newId(),
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
  redirect("/portal?requested=1");
}

/** Confirms an accepted request by email, on the same terms as any booking. */
async function confirmAcceptedBooking(appointmentId: string) {
  const appointment = await orm.Appointment
    .select("id", "scheduledAt", "reminderPreference", "confirmationSentAt")
    .include("patient", (p) => p.select("firstName", "email"))
    .include("doctor", (d) => d.select("fullName"))
    .include("clinic", (c) => c.select("name"))
    .where((a) => a.id.eq(appointmentId))
    .first();

  if (!appointment) return;
  if (appointment.reminderPreference !== "EMAIL") return;
  if (!appointment.patient.email) return;
  if (appointment.confirmationSentAt) return;

  const outcome = await sendAppointmentConfirmation({
    to: appointment.patient.email,
    patientName: appointment.patient.firstName,
    clinicName: appointment.clinic?.name ?? "your clinic",
    doctorName: appointment.doctor.fullName,
    when: formatDateTime(instantFromDb(appointment.scheduledAt)),
    link: appUrl("/portal"),
  });
  if (!outcome.sent) {
    console.error(`[email] confirmation for ${appointmentId}: ${outcome.reason}`);
  }

  await orm.Appointment
    .where((a) => a.id.eq(appointmentId))
    .update({ confirmationSentAt: instantToDb(new Date()) });
}

/** A patient changing their mind before the clinic has answered. */
export async function withdrawRequest(formData: FormData) {
  const patient = await requirePatientAccount();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;

  const own = await orm.AppointmentRequest
    .select("id", "status")
    .where((r) => r.id.eq(requestId))
    // Scoped to this patient's own row, not merely to the clinic: one patient
    // must never be able to touch another's request.
    .where((r) => r.patientId.eq(patient.patientId))
    .first();
  if (!own || own.status !== "PENDING") return;

  await orm.AppointmentRequest.where((r) => r.id.eq(requestId)).update({
    status: "WITHDRAWN",
    updatedAt: instantToDb(new Date()),
  });
  revalidatePath("/portal");
  revalidatePath("/desk/requests");
}

/**
 * Staff declining a request, with a reason the patient will read.
 */
export async function declineRequest(formData: FormData) {
  const staff = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("decisionNote") ?? "").trim();
  if (!requestId) return;

  const request = await orm.AppointmentRequest
    .select("id", "status")
    .where((r) => r.id.eq(requestId))
    .where((r) => r.clinicId.eq(staff.clinicId))
    .first();
  if (!request || request.status !== "PENDING") return;

  const now = instantToDb(new Date());
  await orm.AppointmentRequest.where((r) => r.id.eq(requestId)).update({
    status: "DECLINED",
    decisionNote: note || null,
    decidedById: staff.accountId,
    decidedAt: now,
    updatedAt: now,
  });

  revalidatePath("/desk/requests");
  revalidatePath("/portal");
  redirect("/desk/requests");
}

/**
 * Staff accepting a request, which is the moment a slot is actually taken.
 *
 * Because nothing was held, this can fail: the time may have gone while the
 * request sat waiting. That is not an edge case to be papered over — it is the
 * direct consequence of requests not reserving, and the clinic is told plainly
 * so it can offer another time.
 */
export async function acceptRequest(formData: FormData) {
  const staff = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const time = String(formData.get("time") ?? "").trim();
  if (!requestId) return;

  const request = await orm.AppointmentRequest
    .select("id", "status", "patientId", "doctorId", "preferredDate", "preferredTime", "service", "reason")
    .include("patient", (p) => p.select("reminderPreference"))
    .where((r) => r.id.eq(requestId))
    .where((r) => r.clinicId.eq(staff.clinicId))
    .first();
  if (!request || request.status !== "PENDING") return;

  const chosen = time || request.preferredTime;
  if (!chosen || !/^([01]\d|2[0-3]):[0-5]\d$/.test(chosen)) {
    redirect(`/desk/requests?needs=time&id=${requestId}`);
  }

  const schedule = await loadSchedule(request.doctorId);
  const duration = durationFor(schedule, request.service, SERVICE_MINUTES[request.service]);
  const at = fromDateTimeLocalValue(`${request.preferredDate}T${chosen}`);
  if (!at) redirect(`/desk/requests?needs=time&id=${requestId}`);

  const problem = checkAvailability(schedule, at!, duration, minuteOfDay(at!));
  if (problem) redirect(`/desk/requests?refused=${encodeURIComponent(problem)}&id=${requestId}`);

  const now = instantToDb(new Date());

  // The same lock and overlap check every other booking goes through. Imported
  // rather than reimplemented: a second copy of this logic is a second chance
  // to get it wrong.
  const outcome = await db.transaction(async (tx) => {
    const plan = db.raw.sql`SELECT id FROM "Doctor" WHERE id = ${request.doctorId} FOR UPDATE`
      .affectedCount()
      .build();
    await tx.execute(plan as never);

    const sameDay = await tx.orm.public.Appointment
      .select("id", "scheduledAt", "durationMinutes", "status")
      .where((a) => a.doctorId.eq(request.doctorId))
      .where((a) => a.scheduledAt.gte(instantToDb(new Date(at!.getTime() - 12 * 60 * 60 * 1000))))
      .where((a) => a.scheduledAt.lte(instantToDb(new Date(at!.getTime() + 12 * 60 * 60 * 1000))))
      .all();

    const start = minuteOfDay(at!);
    for (const existing of sameDay) {
      if (existing.status === "CANCELLED" || existing.status === "NO_SHOW") continue;
      const otherStart = minuteOfDay(new Date(existing.scheduledAt.replace(" ", "T") + "Z"));
      if (start < otherStart + existing.durationMinutes && start + duration > otherStart) {
        return { taken: true as const, created: null };
      }
    }

    const created = await tx.orm.public.Appointment.select("id").create({
      id: newId(),
      clinicId: staff.clinicId,
      patientId: request.patientId,
      doctorId: request.doctorId,
      bookedById: staff.accountId,
      scheduledAt: instantToDb(at!),
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
      decidedById: staff.accountId,
      decidedAt: now,
      updatedAt: now,
    });

    return { taken: false as const, created };
  });

  if (outcome.taken) {
    redirect(
      `/desk/requests?refused=${encodeURIComponent("That time went while the request was waiting. Offer another.")}&id=${requestId}`,
    );
  }

  // The patient asked for this one, so they are told it came through — on
  // the same terms as any other booking.
  await confirmAcceptedBooking(outcome.created!.id);

  revalidatePath("/desk/requests");
  revalidatePath("/desk/appointments");
  revalidatePath("/portal");
  redirect(`/desk/appointments/${outcome.created!.id}`);
}
