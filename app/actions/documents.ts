"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { DocumentRequestStatus, DocumentType } from "@/lib/enums";
import { DOCUMENT_FIELDS, DOCUMENT_TRANSITIONS } from "@/lib/documents";
import type { FormState } from "@/lib/validation";

const MAX_TEXT = 4000;

/**
 * Reads the fields this document type declares, and only those.
 *
 * Taking the shape from the same table the form renders means a document
 * cannot quietly acquire a field nobody asked for, and a required field cannot
 * be skipped by posting around the form.
 */
function readDetails(
  type: DocumentType,
  formData: FormData,
): { details: Record<string, string> } | { error: FormState } {
  const details: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};

  for (const field of DOCUMENT_FIELDS[type]) {
    const raw = String(formData.get(`d.${field.name}`) ?? "").trim();

    if (!raw) {
      if (field.required) fieldErrors[`d.${field.name}`] = [`${field.label} is required`];
      continue;
    }
    if (raw.length > MAX_TEXT) {
      fieldErrors[`d.${field.name}`] = [`Keep ${field.label.toLowerCase()} under ${MAX_TEXT} characters`];
      continue;
    }
    if (field.kind === "number" && Number.isNaN(Number(raw))) {
      fieldErrors[`d.${field.name}`] = [`${field.label} must be a number`];
      continue;
    }
    details[field.name] = raw;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: {
        message: "Fill in everything the document has to state.",
        fieldErrors,
      },
    };
  }
  return { details };
}

export async function createDocumentRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const doctor = await requireDoctor();

  const patientId = String(formData.get("patientId") ?? "");
  const rawType = String(formData.get("type") ?? "");
  const purpose = String(formData.get("purpose") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const requesterRelation = String(formData.get("requesterRelation") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const medicalRecordId = String(formData.get("medicalRecordId") ?? "").trim();

  if (!(rawType in DocumentType)) return { message: "Choose a document." };
  const type = rawType as DocumentType;

  const fieldErrors: Record<string, string[]> = {};
  if (!purpose) fieldErrors.purpose = ["Say what it is for"];
  if (!requesterName) fieldErrors.requesterName = ["Say who is asking"];
  if (!requesterRelation) fieldErrors.requesterRelation = ["Say what they are to the patient"];
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "A release needs to say who asked and why.", fieldErrors };
  }

  const patient = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(patientId))
    .where((p) => p.household.some((h) => h.doctorId.eq(doctor.id)))
    .first();
  if (!patient) return { message: "That patient is not on your list." };

  // A document may be tied to one visit, but only to a visit of this patient's
  // that this doctor wrote and has not archived.
  let linkedRecordId: string | null = null;
  if (medicalRecordId) {
    const record = await orm.MedicalRecord
      .select("id")
      .where((r) => r.id.eq(medicalRecordId))
      .where((r) => r.doctorId.eq(doctor.id))
      .where((r) => r.patientId.eq(patient.id))
      .where((r) => r.archivedAt.isNull())
      .first();
    if (!record) return { message: "That visit is not available to draw from." };
    linkedRecordId = record.id;
  }

  const parsed = readDetails(type, formData);
  if ("error" in parsed) return parsed.error;

  const now = instantToDb(new Date());
  const created = await orm.DocumentRequest.select("id").create({
    id: newId(),
    doctorId: doctor.id,
    patientId: patient.id,
    medicalRecordId: linkedRecordId,
    type,
    status: "REQUESTED",
    purpose,
    requesterName,
    requesterRelation,
    details: JSON.stringify(parsed.details),
    notes: notes || null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/documents");
  revalidatePath(`/patients/${patient.id}`);
  redirect(`/documents/${created.id}`);
}

/** Editing the particulars of a request that has not gone out yet. */
export async function updateDocumentRequest(
  requestId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const doctor = await requireDoctor();

  const existing = await orm.DocumentRequest
    .select("id", "patientId", "type", "status")
    .where((r) => r.id.eq(requestId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!existing) return { message: "That request no longer exists." };
  if (existing.status === "RELEASED") {
    return { message: "This document has been handed over — it cannot be changed now." };
  }

  const purpose = String(formData.get("purpose") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const requesterRelation = String(formData.get("requesterRelation") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!purpose) fieldErrors.purpose = ["Say what it is for"];
  if (!requesterName) fieldErrors.requesterName = ["Say who is asking"];
  if (!requesterRelation) fieldErrors.requesterRelation = ["Say what they are to the patient"];
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "A release needs to say who asked and why.", fieldErrors };
  }

  const parsed = readDetails(existing.type, formData);
  if ("error" in parsed) return parsed.error;

  await orm.DocumentRequest.where((r) => r.id.eq(requestId)).update({
    purpose,
    requesterName,
    requesterRelation,
    details: JSON.stringify(parsed.details),
    notes: notes || null,
    updatedAt: instantToDb(new Date()),
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${requestId}`);
  redirect(`/documents/${requestId}`);
}

/**
 * Moves a request along, or refuses the move.
 *
 * Releasing records who it went to: a document leaving the clinic with no note
 * of who received it answers none of the questions anybody asks afterwards.
 */
export async function setDocumentStatus(formData: FormData) {
  const doctor = await requireDoctor();
  const requestId = String(formData.get("requestId") ?? "");
  const raw = String(formData.get("status") ?? "");
  if (!requestId || !(raw in DocumentRequestStatus)) return;

  const status = raw as DocumentRequestStatus;
  const existing = await orm.DocumentRequest
    .select("id", "status", "patientId")
    .where((r) => r.id.eq(requestId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!existing) return;

  if (!DOCUMENT_TRANSITIONS[existing.status].includes(status)) {
    redirect(`/documents/${requestId}?blocked=1`);
  }

  const releasedTo = String(formData.get("releasedTo") ?? "").trim();
  const declineReason = String(formData.get("declineReason") ?? "").trim();

  if (status === "RELEASED" && !releasedTo) {
    redirect(`/documents/${requestId}?needs=releasedTo`);
  }
  if (status === "DECLINED" && !declineReason) {
    redirect(`/documents/${requestId}?needs=declineReason`);
  }

  const now = instantToDb(new Date());
  await orm.DocumentRequest.where((r) => r.id.eq(requestId)).update({
    status,
    releasedAt: status === "RELEASED" ? now : null,
    releasedById: status === "RELEASED" ? doctor.id : null,
    releasedTo: status === "RELEASED" ? releasedTo : null,
    declineReason: status === "DECLINED" ? declineReason : null,
    updatedAt: now,
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${requestId}`);
  revalidatePath(`/patients/${existing.patientId}`);
}

/** A request withdrawn before anything went out. */
export async function deleteDocumentRequest(formData: FormData) {
  const doctor = await requireDoctor();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;

  const existing = await orm.DocumentRequest
    .select("id", "status", "patientId", "type")
    .where((r) => r.id.eq(requestId))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!existing) return;

  // A document that has been handed over is a thing that happened. The request
  // for it is the only record that it happened, so it stays.
  if (existing.status === "RELEASED") {
    redirect(`/documents/${requestId}?blocked=1`);
  }

  await orm.DocumentRequest.where((r) => r.id.eq(requestId)).delete();

  revalidatePath("/documents");
  revalidatePath(`/patients/${existing.patientId}`);
  redirect("/documents");
}

