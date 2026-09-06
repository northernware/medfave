import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { autosaveConsultation, saveMedicalRecord } from "@/app/actions/records";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatDateTime, toDateInputValue, toDateTimeLocalValue } from "@/lib/datetime";
import { fullName } from "@/lib/domain";
import { RecordForm } from "@/components/forms/record-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit record" };

/** Prisma nulls become the empty strings the form's inputs expect. */
const text = (v: string | null) => v ?? "";
const num = (v: number | null) => (v == null ? "" : String(v));

export default async function EditRecordPage({ params }: PageProps<"/records/[id]/edit">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const record = await orm.MedicalRecord
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .include("appointment", (a) => a.select("id", "scheduledAt", "reason"))
    .include("prescriptions", (p) =>
      p
        .select("id", "drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.status === "DRAFT" ? "Consultation notes" : "Edit record"}
        subtitle={fullName(record.patient)}
      />
      <Card className="p-5 sm:p-6">
        <RecordForm
          action={saveMedicalRecord}
          autosave={autosaveConsultation}
          patientId={record.patientId}
          openAppointments={[]}
          lockedAppointment={
            record.appointment
              ? {
                  id: record.appointment.id,
                  label: `${formatDateTime(instantFromDb(record.appointment.scheduledAt))} — ${record.appointment.reason}`,
                }
              : undefined
          }
          defaults={{
            recordId: record.id,
            status: record.status,
            savedAt: instantFromDb(record.updatedAt).toISOString(),
            visitDate: toDateTimeLocalValue(instantFromDb(record.visitDate)),
            appointmentId: record.appointmentId ?? "",
            chiefComplaint: record.chiefComplaint,
            historyOfPresentIllness: text(record.historyOfPresentIllness),
            physicalExamination: text(record.physicalExamination),
            temperatureC: num(record.temperatureC),
            heartRate: num(record.heartRate),
            respiratoryRate: num(record.respiratoryRate),
            systolic: num(record.systolic),
            diastolic: num(record.diastolic),
            weightKg: num(record.weightKg),
            heightCm: num(record.heightCm),
            oxygenSaturation: num(record.oxygenSaturation),
            assessment: text(record.assessment),
            treatmentPlan: text(record.treatmentPlan),
            followUpDate: record.followUpDate ? toDateInputValue(calendarDateFromDb(record.followUpDate)) : "",
            notes: text(record.notes),
            prescriptions: record.prescriptions.map((rx) => ({
              drugName: rx.drugName,
              dosage: rx.dosage,
              frequency: rx.frequency,
              duration: text(rx.duration),
              instructions: text(rx.instructions),
            })),
          }}
          cancelHref={`/records/${record.id}`}
        />
      </Card>
    </div>
  );
}
