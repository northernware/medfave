"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus } from "@/lib/enums";
import { requireDoctor } from "@/lib/auth";
import { db, orm } from "@/src/prisma/db";
import { calendarDateFromDb, calendarDateToDb, instantFromDb, instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import type { RecordSnapshot } from "@/lib/record-versions";
import { fromDateInputValue, fromDateTimeLocalValue } from "@/lib/datetime";
import {
  medicalRecordDraftSchema,
  medicalRecordSchema,
  prescriptionSchema,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

export type PrescriptionInput = {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  instructions: string | null;
};

/**
 * Prescription rows arrive as parallel repeated fields. Rows with no drug name
 * are blank templates the doctor never filled in, so they are dropped.
 */
function readPrescriptions(formData: FormData): { rows: PrescriptionInput[]; error?: FormState } {
  const names = formData.getAll("rx.drugName").map(String);
  const rows: PrescriptionInput[] = [];

  for (let i = 0; i < names.length; i++) {
    const row = {
      drugName: names[i],
      dosage: String(formData.getAll("rx.dosage")[i] ?? ""),
      frequency: String(formData.getAll("rx.frequency")[i] ?? ""),
      duration: String(formData.getAll("rx.duration")[i] ?? ""),
      instructions: String(formData.getAll("rx.instructions")[i] ?? ""),
    };
    if (!row.drugName.trim()) continue;

    const parsed = prescriptionSchema.safeParse(row);
    if (!parsed.success) {
      const flat = toFieldErrors(parsed.error);
      return {
        rows: [],
        error: { message: `Prescription ${i + 1}: ${flat.message}`, fieldErrors: flat.fieldErrors },
      };
    }
    rows.push(parsed.data);
  }

  return { rows };
}

/**
 * Replaces a record's prescription rows. Prisma 8 has no nested or bulk create,
 * so they go in one at a time inside the caller's transaction.
 */
async function writePrescriptions(
  t: typeof orm,
  medicalRecordId: string,
  rows: PrescriptionInput[],
) {
  const now = instantToDb(new Date());
  for (const r of rows) {
    await t.Prescription.create({ ...r, id: newId(), medicalRecordId, createdAt: now });
  }
}

/** What the doctor pressed: still writing, or done. */
type Intent = "draft" | "finish";

/** A transaction context, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Makes sure a note has a version standing for the text it already held.
 *
 * Notes signed before this trail existed have no version rows, and neither
 * does a note whose baseline somehow went missing. Amending one of those would
 * write the new text as version 1 and leave nothing saying what it replaced —
 * exactly the loss the trail is here to prevent. So the state on the row is
 * captured first, attributed to whoever signed it and dated to when they did.
 */
async function ensureBaselineVersion(tx: Tx, recordId: string, fallbackAuthorId: string) {
  const t = tx.orm.public;

  const existing = await t.MedicalRecordVersion
    .select("id")
    .where((v) => v.medicalRecordId.eq(recordId))
    .first();
  if (existing) return;

  const record = await t.MedicalRecord
    .include("prescriptions", (p) =>
      p
        .select("drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(recordId))
    .first();
  if (!record) return;

  const snapshot: RecordSnapshot = {
    visitDate: instantFromDb(record.visitDate).toISOString(),
    chiefComplaint: record.chiefComplaint,
    historyOfPresentIllness: record.historyOfPresentIllness,
    physicalExamination: record.physicalExamination,
    temperatureC: record.temperatureC,
    heartRate: record.heartRate,
    respiratoryRate: record.respiratoryRate,
    systolic: record.systolic,
    diastolic: record.diastolic,
    weightKg: record.weightKg,
    heightCm: record.heightCm,
    oxygenSaturation: record.oxygenSaturation,
    assessment: record.assessment,
    treatmentPlan: record.treatmentPlan,
    followUpDate: record.followUpDate
      ? calendarDateFromDb(record.followUpDate).toISOString().slice(0, 10)
      : null,
    notes: record.notes,
    prescriptions: record.prescriptions.map((rx) => ({ ...rx })),
  };

  await t.MedicalRecordVersion.create({
    id: newId(),
    medicalRecordId: recordId,
    version: 1,
    snapshot: JSON.stringify(snapshot),
    reason: null,
    authorId: record.finalizedById ?? fallbackAuthorId,
    createdAt: record.finalizedAt ?? record.updatedAt,
  });
}

/**
 * Holds one record still for the length of a transaction.
 *
 * Version numbers are read and then written, which two concurrent amendments
 * would both do against the same value; the second would lose to the unique
 * index on (record, version) and take the whole save down with it. The lock
 * makes the second wait and read the number the first just used.
 */
async function lockRecord(tx: Tx, recordId: string) {
  const plan = db.raw.sql`SELECT id FROM "MedicalRecord" WHERE id = ${recordId} FOR UPDATE`
    .affectedCount()
    .build();
  await tx.execute(plan as never);
}

type WriteOutcome =
  | { error: FormState }
  | { recordId: string; patientId: string; savedAt: Date };

/**
 * Writes a consultation, whether it is being drafted or finished.
 *
 * Creating and updating used to be two functions that had drifted apart. They
 * are one path now, because autosave makes the difference invisible anyway: the
 * first save of a new note creates the row, every save after that updates it,
 * and the doctor never sees which happened.
 */
async function writeConsultation(
  doctorId: string,
  formData: FormData,
  intent: Intent,
): Promise<WriteOutcome> {
  // A draft is held to every rule except being complete. See the schemas.
  const schema = intent === "finish" ? medicalRecordSchema : medicalRecordDraftSchema;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: toFieldErrors(parsed.error) };

  const recordId = String(formData.get("recordId") ?? "").trim();
  const { patientId, appointmentId, visitDate, followUpDate, ...rest } = parsed.data;

  const patient = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.household.some((h) => h.doctorId.eq(doctorId)))
    .first();
  if (!patient) return { error: { message: "That patient is not on your list." } };

  const existing = recordId
    ? await orm.MedicalRecord
        .select("id", "patientId", "status", "appointmentId", "archivedAt")
        .where((r) => r.id.eq(recordId))
        .where((r) => r.doctorId.eq(doctorId))
        .first()
    : null;
  if (recordId && !existing) return { error: { message: "That record no longer exists." } };

  // A signed note is not something autosave may quietly rewrite. Changing one
  // is a deliberate act with its own trail; drafting is not it.
  if (existing && existing.status !== "DRAFT" && intent === "draft") {
    return { error: { message: "This note has been signed — it cannot be saved as a draft." } };
  }

  if (existing?.archivedAt) {
    return { error: { message: "This record is archived. Restore it before making changes." } };
  }

  // Changing a note that has been signed is an amendment, and an amendment
  // without a reason is indistinguishable from a note that was always this
  // way. The reason is the part that makes the trail worth keeping.
  const amending = Boolean(existing) && existing!.status !== "DRAFT" && intent === "finish";
  const amendmentReason = String(formData.get("amendmentReason") ?? "").trim();
  if (amending && !amendmentReason) {
    return {
      error: {
        message: "Say what is being corrected and why.",
        fieldErrors: { amendmentReason: ["A reason is required to amend a signed note"] },
      },
    };
  }
  if (amendmentReason.length > 500) {
    return {
      error: {
        message: "Keep the amendment reason under 500 characters.",
        fieldErrors: { amendmentReason: ["Too long"] },
      },
    };
  }

  const visitedAt = fromDateTimeLocalValue(visitDate);
  if (!visitedAt) {
    return { error: { message: "Check the visit date.", fieldErrors: { visitDate: ["Invalid date"] } } };
  }

  // The appointment a note documents is settled when the note is created and
  // not revisited: re-resolving it on every autosave would fight the
  // "already documented" rule against the record's own link.
  let linkedAppointmentId: string | null = existing?.appointmentId ?? null;
  if (!existing && appointmentId) {
    const appointment = await orm.Appointment
      .select("id")
      .where((a) => a.id.eq(appointmentId))
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.patientId.eq(patientId))
      .where((a) => a.medicalRecord.none((r) => r.id.isNotNull()))
      .first();
    if (!appointment) {
      return { error: { message: "That appointment is unavailable or already has a record." } };
    }
    linkedAppointmentId = appointment.id;
  }

  const { rows, error } = readPrescriptions(formData);
  if (error) return { error };

  const savedAt = new Date();
  const now = instantToDb(savedAt);
  const followUp = followUpDate ? fromDateInputValue(followUpDate) : null;

  const scalars = {
    ...rest,
    visitDate: instantToDb(visitedAt),
    followUpDate: followUp ? calendarDateToDb(followUp) : null,
    updatedAt: now,
  };

  const id = await db.transaction(async (tx) => {
    const t = tx.orm.public;

    // Two amendments racing would otherwise compute the same next version
    // number and one would lose to the unique index. The row lock makes the
    // second wait and see the first.
    if (existing) await lockRecord(tx, existing.id);
    // Before the new text lands, not after.
    if (amending) await ensureBaselineVersion(tx, existing!.id, doctorId);

    // Signing stamps who signed it and when, once. Re-saving a note that is
    // already signed leaves the original signature alone — it records when the
    // note was committed to, which a later edit does not change. An amendment
    // says so in the status instead.
    const signature =
      intent === "finish" && (!existing || existing.status === "DRAFT")
        ? { status: "FINALIZED" as const, finalizedAt: now, finalizedById: doctorId }
        : amending
          ? { status: "AMENDED" as const }
          : {};

    let targetId: string;
    if (existing) {
      await t.MedicalRecord.where((r) => r.id.eq(existing.id)).update({ ...scalars, ...signature });
      targetId = existing.id;

      // The prescription list is edited as a whole, so replace it wholesale.
      // `.delete()` on the ORM removes one row; prescriptions are matched by a
      // non-unique key, so this has to go through the SQL-builder lane or all
      // but one would survive the edit.
      const clear = tx.sql.public.Prescription
        .delete()
        .where((f, fns) => fns.eq(f.medicalRecordId, existing.id))
        .build();
      await tx.execute(clear as never);
    } else {
      const created = await t.MedicalRecord.select("id").create({
        ...scalars,
        id: newId(),
        patientId,
        doctorId,
        appointmentId: linkedAppointmentId,
        status: "DRAFT",
        createdAt: now,
        ...signature,
      });
      targetId = created.id;
    }

    await writePrescriptions(t, targetId, rows);

    // Finishing the consultation is what completes the visit — saving a draft
    // is not. The appointment used to be marked done the moment a record row
    // existed, which meant an unfinished note closed the visit behind the
    // doctor's back.
    if (intent === "finish" && linkedAppointmentId) {
      await t.Appointment
        .where((a) => a.id.eq(linkedAppointmentId))
        // A visit deliberately marked cancelled or missed stays that way; a
        // note written about it does not undo that decision.
        .where((a) => a.status.notIn(["CANCELLED", "NO_SHOW"]))
        .update({ status: AppointmentStatus.COMPLETED, updatedAt: now });
    }

    // Every signature and every amendment leaves a version behind. Nothing is
    // written on a draft save: a draft has not been committed to, so there is
    // no state anyone relied on to preserve.
    if (intent === "finish") {
      const snapshot: RecordSnapshot = {
        visitDate: visitedAt.toISOString(),
        chiefComplaint: scalars.chiefComplaint,
        historyOfPresentIllness: scalars.historyOfPresentIllness,
        physicalExamination: scalars.physicalExamination,
        temperatureC: scalars.temperatureC,
        heartRate: scalars.heartRate,
        respiratoryRate: scalars.respiratoryRate,
        systolic: scalars.systolic,
        diastolic: scalars.diastolic,
        weightKg: scalars.weightKg,
        heightCm: scalars.heightCm,
        oxygenSaturation: scalars.oxygenSaturation,
        assessment: scalars.assessment,
        treatmentPlan: scalars.treatmentPlan,
        followUpDate: followUp ? followUp.toISOString().slice(0, 10) : null,
        notes: scalars.notes,
        prescriptions: rows,
      };

      const previous = await t.MedicalRecordVersion
        .select("version")
        .where((v) => v.medicalRecordId.eq(targetId))
        .orderBy((v) => v.version.desc())
        .first();

      await t.MedicalRecordVersion.create({
        id: newId(),
        medicalRecordId: targetId,
        version: (previous?.version ?? 0) + 1,
        snapshot: JSON.stringify(snapshot),
        // The first signature has no prior state to explain.
        reason: amending ? amendmentReason : null,
        authorId: doctorId,
        createdAt: now,
      });
    }

    return targetId;
  });

  return { recordId: id, patientId, savedAt };
}

function revalidateRecord(recordId: string, patientId: string) {
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/records/${recordId}`);
  revalidatePath("/appointments");
  revalidatePath("/");
}

/**
 * The form's two buttons. "Save draft" keeps the note open; "Finish
 * consultation" validates it in full, signs it, and closes the visit.
 */
export async function saveMedicalRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  const doctor = await requireDoctor();
  const intent: Intent = formData.get("intent") === "finish" ? "finish" : "draft";

  const outcome = await writeConsultation(doctor.id, formData, intent);
  if ("error" in outcome) return outcome.error;

  revalidateRecord(outcome.recordId, outcome.patientId);
  // A finished note is read; an unfinished one is carried on with.
  redirect(
    intent === "finish" ? `/records/${outcome.recordId}` : `/records/${outcome.recordId}/edit`,
  );
}

export type AutosaveResult =
  | { ok: true; recordId: string; savedAt: string }
  | { ok: false; message: string };

/**
 * The background save, called from the open form while the doctor types.
 *
 * It returns the record's id rather than redirecting, because the first
 * autosave of a new note is what gives that note an id at all — the form keeps
 * it so every later save, and the eventual signature, land on the same row
 * instead of scattering half-written duplicates across the chart.
 */
export async function autosaveConsultation(formData: FormData): Promise<AutosaveResult> {
  const doctor = await requireDoctor();
  const outcome = await writeConsultation(doctor.id, formData, "draft");
  if ("error" in outcome) {
    return { ok: false, message: outcome.error.message ?? "Could not save." };
  }

  revalidateRecord(outcome.recordId, outcome.patientId);
  return { ok: true, recordId: outcome.recordId, savedAt: outcome.savedAt.toISOString() };
}

/**
 * Takes a record out of the working chart without destroying it.
 *
 * A clinical record is evidence of what was decided and when. Deleting one
 * removes the evidence and leaves nothing to say it ever existed, which is the
 * opposite of what a record is for — so this hides it from the ordinary lists
 * and keeps it readable, restorable, and attributed to whoever set it aside.
 */
export async function archiveMedicalRecord(formData: FormData) {
  const doctor = await requireDoctor();
  const recordId = String(formData.get("recordId") ?? "");
  const reason = String(formData.get("archiveReason") ?? "").trim();
  if (!recordId) return;

  const record = await orm.MedicalRecord
    .select("patientId", "archivedAt")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record || record.archivedAt) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    archivedAt: now,
    archivedById: doctor.id,
    archiveReason: reason || null,
    updatedAt: now,
  });

  revalidateRecord(recordId, record.patientId);
  redirect(`/patients/${record.patientId}`);
}

/** Puts an archived record back into the chart. */
export async function restoreMedicalRecord(formData: FormData) {
  const doctor = await requireDoctor();
  const recordId = String(formData.get("recordId") ?? "");
  if (!recordId) return;

  const record = await orm.MedicalRecord
    .select("patientId", "archivedAt")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record || !record.archivedAt) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    updatedAt: now,
  });

  revalidateRecord(recordId, record.patientId);
  redirect(`/records/${recordId}`);
}

/**
 * Records that a follow-up is no longer needed.
 *
 * This is the only way a live follow-up leaves the queue without a completed
 * visit, and it is a decision rather than an inference — hence the reason, and
 * hence storing who made it.
 */
export async function closeFollowUp(recordId: string, formData: FormData): Promise<void> {
  const doctor = await requireDoctor();
  const reason = String(formData.get("reason") ?? "").trim();

  const owned = await orm.MedicalRecord
    .select("id", "patientId")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .where((r) => r.followUpDate.isNotNull())
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    followUpClosedAt: now,
    followUpClosedReason: reason || null,
    followUpClosedById: doctor.id,
    updatedAt: now,
  });

  revalidatePath(`/records/${recordId}`);
  revalidatePath(`/patients/${owned.patientId}`);
  revalidatePath("/");
}

/** Puts a closed follow-up back into the queue. */
export async function reopenFollowUp(recordId: string): Promise<void> {
  const doctor = await requireDoctor();
  const owned = await orm.MedicalRecord
    .select("id", "patientId")
    .where((r) => r.id.eq(recordId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!owned) return;

  const now = instantToDb(new Date());
  await orm.MedicalRecord.where((r) => r.id.eq(recordId)).update({
    followUpClosedAt: null,
    followUpClosedReason: null,
    followUpClosedById: null,
    updatedAt: now,
  });

  revalidatePath(`/records/${recordId}`);
  revalidatePath(`/patients/${owned.patientId}`);
  revalidatePath("/");
}
