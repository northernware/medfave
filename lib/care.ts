import "server-only";
import { orm } from "@/src/prisma/db";

/*
 * Who a doctor cares for, in a clinic where patients are the clinic's
 * (medfave-design plans/group-practice-findings.md, decision 2).
 *
 * Three layers:
 *   1. Details (name, birthday, contact, household): everyone at the clinic.
 *   2. The chart (allergies, conditions, medications, alerts): doctors caring
 *      for the patient.
 *   3. Visit notes: only the doctor who wrote them.
 *
 * A doctor cares for a patient once they've registered them (the household is
 * theirs), booked or seen them, written about them, or been asked for by them.
 * A clinic with **shared charts** on opens layers 2 and 3 to every doctor
 * there: notes stay read-only to anyone but their author.
 */

import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";

/** Whether this clinic shares charts between its doctors. */
export async function sharesCharts(clinicId: string): Promise<boolean> {
  const clinic = await orm.Clinic.select("sharedCharts").where((c) => c.id.eq(clinicId)).first();
  return clinic?.sharedCharts ?? false;
}

/** Every patient of the clinic this doctor cares for, by id. */
export async function caredForIds(doctor: { id: string; clinicId: string }): Promise<Set<string>> {
  if (await sharesCharts(doctor.clinicId)) {
    const all = await orm.Patient.select("id").where((p) => p.clinicId.eq(doctor.clinicId)).all();
    return new Set(all.map((p) => p.id));
  }
  const [registered, booked, written, asked] = await Promise.all([
    orm.Patient
      .select("id")
      .where((p) => p.clinicId.eq(doctor.clinicId))
      .where((p) => p.household.some((h) => h.doctorId.eq(doctor.id)))
      .all(),
    orm.Appointment.select("patientId").where((a) => a.doctorId.eq(doctor.id)).all(),
    orm.MedicalRecord.select("patientId").where((r) => r.doctorId.eq(doctor.id)).all(),
    orm.AppointmentRequest.select("patientId").where((r) => r.doctorId.eq(doctor.id)).all(),
  ]);
  return new Set([
    ...registered.map((p) => p.id),
    ...booked.map((a) => a.patientId),
    ...written.map((r) => r.patientId),
    ...asked.map((r) => r.patientId),
  ]);
}

/** Whether this doctor cares for this patient: may read their chart. */
export async function caresFor(doctor: { id: string; clinicId: string }, patientId: string): Promise<boolean> {
  if (await sharesCharts(doctor.clinicId)) {
    return Boolean(
      await orm.Patient.select("id").where((p) => p.id.eq(patientId)).where((p) => p.clinicId.eq(doctor.clinicId)).first(),
    );
  }
  const [registered, booked, written, asked] = await Promise.all([
    orm.Patient
      .select("id")
      .where((p) => p.id.eq(patientId))
      .where((p) => p.clinicId.eq(doctor.clinicId))
      .where((p) => p.household.some((h) => h.doctorId.eq(doctor.id)))
      .first(),
    orm.Appointment.select("id").where((a) => a.patientId.eq(patientId)).where((a) => a.doctorId.eq(doctor.id)).first(),
    orm.MedicalRecord.select("id").where((r) => r.patientId.eq(patientId)).where((r) => r.doctorId.eq(doctor.id)).first(),
    orm.AppointmentRequest.select("id").where((r) => r.patientId.eq(patientId)).where((r) => r.doctorId.eq(doctor.id)).first(),
  ]);
  return Boolean(registered || booked || written || asked);
}

/** An id list for `.in(...)` that is never empty: an empty IN is not valid SQL. */
export function idsOrNone(ids: Iterable<string>): string[] {
  const list = [...ids];
  return list.length > 0 ? list : ["00000000-0000-0000-0000-000000000000"];
}

/**
 * Whether this doctor may read a visit note: their own, or any at a clinic
 * that shares charts. Only the author may change it.
 */
export async function canReadNote(
  doctor: { id: string; clinicId: string },
  note: { doctorId: string; clinicId: string },
): Promise<boolean> {
  if (note.clinicId !== doctor.clinicId) return false;
  return note.doctorId === doctor.id || (await sharesCharts(doctor.clinicId));
}

/** Records that somebody opened a patient's chart, or one of its notes. */
export async function logChartAccess(entry: { clinicId: string; patientId: string; accountId: string; recordId?: string }) {
  await orm.ChartAccess.create({
    id: newId(),
    clinicId: entry.clinicId,
    patientId: entry.patientId,
    accountId: entry.accountId,
    recordId: entry.recordId ?? null,
    openedAt: instantToDb(new Date()),
  });
}
