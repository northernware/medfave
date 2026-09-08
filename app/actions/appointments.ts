"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus } from "@/lib/enums";
import { requireDoctor } from "@/lib/auth";
import { db, orm } from "@/src/prisma/db";
import {
  clinicDayRange,
  fromDateTimeLocalValue,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { SERVICE_MINUTES } from "@/lib/domain";
import { formatSpan, minuteOfDay, occupiesSlot, overlaps } from "@/lib/scheduling";
import { checkAvailability, durationFor } from "@/lib/availability";
import { loadSchedule } from "@/lib/queries";
import { appointmentSchema, toFieldErrors, type FormState } from "@/lib/validation";

async function assertOwnsPatient(doctorId: string, patientId: string) {
  const patient = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.household.some((h) => h.doctorId.eq(doctorId)))
    .first();
  return patient !== null;
}

/** The appointment columns a booking form decides — relations and audit keys excluded. */
type AppointmentScalars = Omit<
  Parameters<typeof orm.Appointment.create>[0],
  | "id"
  | "doctorId"
  | "createdAt"
  | "updatedAt"
  | "doctor"
  | "patient"
  | "previousAppointment"
  | "followUps"
  | "medicalRecord"
  | "followUpForRecord"
>;

/**
 * Turns validated form fields into a row, refusing anything the clinic's rules
 * or an existing booking would not allow. The form mirrors these rules to keep
 * the UI honest, but this is what actually decides — a stale slot list or a
 * direct POST both land here.
 */
async function resolveBooking(
  doctorId: string,
  data: ReturnType<typeof appointmentSchema.parse>,
  ignoreAppointmentId?: string,
): Promise<{ error: FormState } | { data: AppointmentScalars; scheduledAt: Date; durationMinutes: number }> {
  const { patientId, date, time, service, previousAppointmentId, type, ...rest } = data;

  if (!(await assertOwnsPatient(doctorId, patientId))) {
    return { error: { message: "That patient is not on your list." } };
  }

  const scheduledAt = fromDateTimeLocalValue(`${date}T${time}`);
  if (!scheduledAt) {
    return { error: { message: "Check the date and time.", fieldErrors: { time: ["Invalid time"] } } };
  }

  // Duration follows the service, unless the clinic has set its own length.
  const schedule = await loadSchedule(doctorId);
  const durationMinutes = durationFor(schedule, service, SERVICE_MINUTES[service]);

  // The clinic's own week, breaks and closures — not module constants. A
  // walk-in is exempt from the lead time: the patient is already at the desk.
  const ruleBreak = checkAvailability(
    schedule,
    scheduledAt,
    durationMinutes,
    minuteOfDay(scheduledAt),
    { allowSameDay: data.source === "WALK_IN" },
  );
  if (ruleBreak) {
    return {
      error: {
        message: ruleBreak,
        fieldErrors: { date: [ruleBreak] },
      },
    };
  }

  // The overlap check does NOT happen here. It has to run inside the same
  // transaction as the write, under a lock — see `findClash`.

  // Only chain to a previous visit that is this doctor's and this patient's.
  let previousId: string | null = null;
  if (previousAppointmentId) {
    let previousQuery = orm.Appointment
      .select("id")
      .where((a) => a.id.eq(previousAppointmentId))
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.patientId.eq(patientId));
    if (ignoreAppointmentId) {
      previousQuery = previousQuery.where((a) => a.id.neq(ignoreAppointmentId));
    }
    const previous = await previousQuery.first();
    if (!previous) {
      return { error: { message: "That previous appointment is not available to link." } };
    }
    previousId = previous.id;
  }

  return {
    scheduledAt,
    durationMinutes,
    data: {
      ...rest,
      patientId,
      service,
      durationMinutes,
      visitType: type,
      scheduledAt: instantToDb(scheduledAt),
      previousAppointmentId: previousId,
    },
  };
}

/** A transaction context, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Serialises every booking for one doctor.
 *
 * Checking availability and then inserting are two statements; without this
 * two concurrent requests both see the slot free and both write. Taking a row
 * lock on the doctor makes the second request wait for the first to commit, so
 * its re-check sees the appointment the first one just made. The lock is held
 * until the transaction ends — that is what `FOR UPDATE` gives us.
 *
 * A database-level exclusion constraint over a time range would be stronger
 * still, because it would bind writers that never take this lock. Prisma 8's
 * contract cannot express `EXCLUDE USING gist` today, so the guarantee lives
 * here instead: every write path for appointments must go through this.
 */
async function lockDoctorSchedule(tx: Tx, doctorId: string) {
  // No rows are wanted — only the lock the statement takes. `affectedCount`
  // avoids having to name a codec for a column we would throw away.
  const plan = db.raw.sql`SELECT id FROM "Doctor" WHERE id = ${doctorId} FOR UPDATE`
    .affectedCount()
    .build();
  await tx.execute(plan as never);
}

/**
 * The first existing appointment the proposed one would overlap, or null.
 *
 * Overlap is `newStart < existingEnd AND newEnd > existingStart` — identical
 * start times are only the most obvious case of it. Cancelled and no-show
 * visits do not hold their time (see `occupiesSlot`), so their slots are free
 * to rebook.
 */
async function findClash(
  tx: Tx,
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number,
  ignoreAppointmentId?: string,
) {
  const { start, end } = clinicDayRange(scheduledAt);
  let query = tx.orm.public.Appointment
    .select("id", "scheduledAt", "durationMinutes", "status")
    .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
    .where((a) => a.doctorId.eq(doctorId))
    .where((a) => a.scheduledAt.gte(instantToDb(start)))
    .where((a) => a.scheduledAt.lt(instantToDb(end)));
  if (ignoreAppointmentId) {
    query = query.where((a) => a.id.neq(ignoreAppointmentId));
  }

  const proposedStart = minuteOfDay(scheduledAt);
  for (const existing of await query.all()) {
    if (!occupiesSlot(existing.status)) continue;
    const existingStart = minuteOfDay(instantFromDb(existing.scheduledAt));
    if (
      overlaps(proposedStart, durationMinutes, [
        { start: existingStart, end: existingStart + existing.durationMinutes },
      ])
    ) {
      return { ...existing, startMinute: existingStart };
    }
  }
  return null;
}

/** The message a losing racer sees. Names the time so it is actionable. */
function clashMessage(clash: { startMinute: number; durationMinutes: number }): FormState {
  const span = formatSpan(clash.startMinute, clash.durationMinutes);
  const message = `That time is no longer free — ${span} is already booked. Pick another slot.`;
  return { message, fieldErrors: { time: [message] } };
}

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const resolved = await resolveBooking(doctor.id, parsed.data);
  if ("error" in resolved) return resolved.error;

  const followUpFor = String(formData.get("followUpFor") ?? "");

  // Availability is re-checked here, inside the lock, rather than trusting the
  // check the form did: between rendering the slot list and this write, anyone
  // could have taken it.
  const outcome = await db.transaction(async (tx) => {
    await lockDoctorSchedule(tx, doctor.id);

    const clash = await findClash(tx, doctor.id, resolved.scheduledAt, resolved.durationMinutes);
    if (clash) return { clash, created: null };

    const now = instantToDb(new Date());

    // A walk-in is already standing at the desk, so it joins the queue on
    // arrival rather than waiting for someone to check it in afterwards. Only
    // a status that means "has not turned up yet" is overridden: staff writing
    // up a visit that already happened, or one the patient left before, said
    // what they meant and it is not this action's place to argue.
    const walkIn = resolved.data.source === "WALK_IN";
    const notYetArrived =
      resolved.data.status === "PENDING" || resolved.data.status === "CONFIRMED";
    const status = walkIn && notYetArrived ? ("CHECKED_IN" as const) : resolved.data.status;

    const created = await tx.orm.public.Appointment.select("id", "patientId").create({
      ...resolved.data,
      id: newId(),
      doctorId: doctor.id,
      status,
      // Arrival is stamped whenever the visit starts out in the queue, however
      // it got there — not only on the walk-in path.
      ...(status === "CHECKED_IN" ? { arrivedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });

    // Booked to satisfy an earlier visit's follow-up: link it so the record
    // stops showing as due. Scoped to this doctor and patient.
    if (followUpFor) {
      const record = await tx.orm.public.MedicalRecord
        .select("id", "followUpAppointmentId")
        .include("followUpAppointment", (a) => a.select("status"))
        .where((r) => r.id.eq(followUpFor))
        .where((r) => r.doctorId.eq(doctor.id))
        .where((r) => r.patientId.eq(created.patientId))
        .first();

      // A link to a booking that fell through is not a satisfied follow-up —
      // it is the reason the follow-up came back. Refusing to replace it meant
      // rebooking a cancelled or missed follow-up left the record pointing at
      // the dead appointment, so it stayed on the due list however many times
      // it was rebooked. A link to a visit that is still expected or already
      // happened is left alone.
      const replaceable =
        record !== null &&
        (record.followUpAppointmentId === null ||
          record.followUpAppointment?.status === "CANCELLED" ||
          record.followUpAppointment?.status === "NO_SHOW");

      if (replaceable) {
        await tx.orm.public.MedicalRecord
          .where((r) => r.id.eq(record.id))
          .update({ followUpAppointmentId: created.id, updatedAt: now });
      }
    }

    return { clash: null, created };
  });

  if (outcome.clash) return clashMessage(outcome.clash);
  const appointment = outcome.created;
  if (followUpFor) revalidatePath(`/records/${followUpFor}`);

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/patients/${appointment.patientId}`);
  redirect(`/appointments/${appointment.id}`);
}

export async function updateAppointment(
  appointmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const doctor = await requireDoctor();
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const owned = await orm.Appointment
    .select("id")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!owned) return { message: "That appointment no longer exists." };

  const resolved = await resolveBooking(doctor.id, parsed.data, appointmentId);
  if ("error" in resolved) return resolved.error;

  // Rescheduling races the same way a new booking does, and a service change
  // can lengthen the visit into a neighbour, so the same locked re-check applies.
  const outcome = await db.transaction(async (tx) => {
    await lockDoctorSchedule(tx, doctor.id);

    const clash = await findClash(
      tx,
      doctor.id,
      resolved.scheduledAt,
      resolved.durationMinutes,
      appointmentId,
    );
    if (clash) return { clash };

    await tx.orm.public.Appointment
      .where((a) => a.id.eq(appointmentId))
      .update({ ...resolved.data, updatedAt: instantToDb(new Date()) });
    return { clash: null };
  });

  if (outcome.clash) return clashMessage(outcome.clash);

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath(`/patients/${parsed.data.patientId}`);
  redirect(`/appointments/${appointmentId}`);
}

/**
 * The timestamps a move into the queue sets, given what is already recorded.
 *
 * Both are stamped once and then left alone: correcting a status later must not
 * restart a clock that has already run. Arrival is implied by being in the
 * room, so a patient taken straight into consultation gets an arrival time
 * too — otherwise the visit would show no waiting time at all rather than none.
 */
type Instant = ReturnType<typeof instantToDb>;

function queueStamps(
  status: AppointmentStatus,
  existing: { arrivedAt: unknown; consultationStartedAt: unknown },
  now: Instant,
) {
  const stamps: { arrivedAt?: Instant; consultationStartedAt?: Instant } = {};
  if ((status === "CHECKED_IN" || status === "IN_CONSULTATION") && !existing.arrivedAt) {
    stamps.arrivedAt = now;
  }
  if (status === "IN_CONSULTATION" && !existing.consultationStartedAt) {
    stamps.consultationStartedAt = now;
  }
  return stamps;
}

/**
 * Takes the patient into the room and opens their notes in one move.
 *
 * Writing up a consultation used to leave the appointment sitting at "checked
 * in", so the queue still showed someone as waiting while the doctor was with
 * them. The state change and the notes are the same action now, because in the
 * clinic they are the same act.
 */
export async function startConsultation(formData: FormData) {
  const doctor = await requireDoctor();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return;

  const appointment = await orm.Appointment
    .select("id", "patientId", "arrivedAt", "consultationStartedAt")
    .include("medicalRecord", (r) => r.select("id"))
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!appointment) return;

  const now = instantToDb(new Date());
  await orm.Appointment
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .update({
      status: "IN_CONSULTATION",
      ...queueStamps("IN_CONSULTATION", appointment, now),
      updatedAt: now,
    });

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/appointments/${appointmentId}`);

  // Straight to the notes: an existing record is resumed rather than duplicated.
  redirect(
    appointment.medicalRecord
      ? `/records/${appointment.medicalRecord.id}/edit`
      : `/records/new?patientId=${appointment.patientId}&appointmentId=${appointmentId}`,
  );
}

/** Quick status change from the detail page — no full form round-trip. */
export async function setAppointmentStatus(formData: FormData) {
  const doctor = await requireDoctor();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const raw = String(formData.get("status") ?? "");

  if (!appointmentId || !(raw in AppointmentStatus)) return;

  const now = instantToDb(new Date());
  const status = raw as AppointmentStatus;

  const existing = await orm.Appointment
    .select("status", "scheduledAt", "durationMinutes", "arrivedAt", "consultationStartedAt")
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .first();
  if (!existing) return;

  const changes = { status, ...queueStamps(status, existing, now), updatedAt: now };

  /**
   * Cancelling frees the slot, so someone else can be booked into it. Putting
   * this appointment back therefore re-claims a time that may no longer be
   * free, which makes it a booking — and every booking goes through the lock
   * and the overlap check. Skipping them here was how a restored cancellation
   * could quietly land on top of the visit booked to replace it.
   *
   * Every other move is safe without the lock: cancelling and marking a
   * no-show give a slot up, and the rest are between statuses that all hold
   * the slot this appointment already had.
   */
  if (occupiesSlot(existing.status) || !occupiesSlot(status)) {
    await orm.Appointment
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.doctorId.eq(doctor.id))
      .update(changes);
  } else {
    const clash = await db.transaction(async (tx) => {
      await lockDoctorSchedule(tx, doctor.id);

      const found = await findClash(
        tx,
        doctor.id,
        instantFromDb(existing.scheduledAt),
        existing.durationMinutes,
        appointmentId,
      );
      if (found) return found;

      await tx.orm.public.Appointment
        .where((a) => a.id.eq(appointmentId))
        .where((a) => a.doctorId.eq(doctor.id))
        .update(changes);
      return null;
    });

    // A plain form has nowhere to put an error, so the appointment's own page
    // says what happened and points at the booking that is in the way.
    if (clash) redirect(`/appointments/${appointmentId}?clash=${clash.id}`);
  }

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function deleteAppointment(formData: FormData) {
  const doctor = await requireDoctor();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return;

  await orm.Appointment
    .where((a) => a.id.eq(appointmentId))
    .where((a) => a.doctorId.eq(doctor.id))
    .delete();

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/appointments");
}
