import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePatient } from "@/app/actions/patients";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatCalendarDate, formatDate } from "@/lib/datetime";
import {
  ageFrom,
  bloodPressure,
  BLOOD_TYPE_LABELS,
  fullName,
  RELATIONSHIP_LABELS,
  SEX_LABELS,
} from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { AlertBanner, AllergyBanner } from "@/components/allergy-banner";
import { DangerZone } from "@/components/danger-zone";
import { Badge, Card, Detail, EmptyState, PageHeader, SectionTitle, buttonClass } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/patients/[id]">): Promise<Metadata> {
  const doctor = await requireDoctor();
  const { id } = await params;
  const patient = await orm.Patient
    .select("firstName", "middleName", "lastName")
    .where((p) => p.id.eq(id))
    .where((p) => p.household.some((h) => h.doctorId.eq(doctor.id)))
    .first();
  return { title: patient ? fullName(patient) : "Patient" };
}

export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const patient = await orm.Patient
    .include("household", (h) => h.select("id", "name", "contactNumber"))
    .include("allergies", (a) => a.select("id", "label", "reaction", "severity", "notes"))
    .include("conditions", (c) =>
      c.select("id", "label", "notes").orderBy((x) => x.label.asc()),
    )
    .include("medications", (m) =>
      m
        .select("id", "label", "dosage", "frequency", "notes")
        .orderBy((x) => x.label.asc()),
    )
    .include("alerts", (a) => a.select("id", "label", "notes").orderBy((x) => x.label.asc()))
    .include("medicalRecords", (r) =>
      r
        .select(
          "id",
          "status",
          "archivedAt",
          "visitDate",
          "chiefComplaint",
          "assessment",
          "systolic",
          "diastolic",
          "temperatureC",
          "weightKg",
        )
        .include("prescriptions", (rx) => rx.count())
        .orderBy((x) => x.visitDate.desc()),
    )
    .where((p) => p.id.eq(id))
    .where((p) => p.household.some((h) => h.doctorId.eq(doctor.id)))
    .first();
  if (!patient) notFound();

  const appointments = (
    await appointmentListQuery()
      .where((a) => a.patientId.eq(patient.id))
      .where((a) => a.doctorId.eq(doctor.id))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(8)
      .all()
  ).map(toAppointmentListItem);

  // An archived visit is out of the chart but not gone; it is listed apart,
  // below, so the history reads as what actually counts without pretending the
  // rest never happened.
  const visits = patient.medicalRecords.filter((r) => r.archivedAt === null);
  const archivedVisits = patient.medicalRecords.filter((r) => r.archivedAt !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName(patient)}
        subtitle={
          <>
            <Link href={`/households/${patient.household.id}`} className="text-accent-ink hover:underline">
              {patient.household.name} household
            </Link>
            {" · "}
            {RELATIONSHIP_LABELS[patient.relationship]} · {SEX_LABELS[patient.sex]} ·{" "}
            {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
          </>
        }
        actions={
          <>
            <Link href={`/records/new?patientId=${patient.id}`} className={buttonClass("primary")}>
              Document visit
            </Link>
            <Link href={`/appointments/new?patientId=${patient.id}`} className={buttonClass("secondary")}>
              Book
            </Link>
            <Link href={`/patients/${patient.id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* The timeline is what the doctor reads; it gets the width. */}
        <div className="space-y-6 lg:col-span-2">
      <section>
        <SectionTitle
          title="Visit history"
          hint={
            visits.length > 0
              ? `${visits.length} recorded${archivedVisits.length > 0 ? ` · ${archivedVisits.length} archived` : ""}`
              : archivedVisits.length > 0
                ? `${archivedVisits.length} archived`
                : undefined
          }
          action={
            <Link
              href={`/records/new?patientId=${patient.id}`}
              className="font-medium text-accent-ink hover:underline"
            >
              Document visit
            </Link>
          }
        />
        <Card>
        {visits.length === 0 ? (
          <EmptyState
            title="No visits recorded"
            description="Document a consultation and it will build this patient's history."
            action={
              <Link href={`/records/new?patientId=${patient.id}`} className={buttonClass("primary")}>
                Document visit
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visits.map((record) => {
              const bp = bloodPressure(record.systolic, record.diastolic);
              const vitals = [
                bp ? `BP ${bp}` : null,
                record.temperatureC != null ? `${record.temperatureC}°C` : null,
                record.weightKg != null ? `${record.weightKg} kg` : null,
              ].filter(Boolean);

              return (
                <li key={record.id} className="transition-colors hover:bg-surface-muted">
                  <Link href={`/records/${record.id}`} className="block px-4 py-3">
                    <div className="flex items-baseline gap-4">
                      <span className="tabular w-24 shrink-0 text-[13px] text-ink-muted">
                        {formatDate(instantFromDb(record.visitDate))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{record.chiefComplaint}</span>
                        {record.assessment ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {record.assessment}
                          </span>
                        ) : null}
                      </span>
                      {record.prescriptions > 0 ? (
                        <Badge tone="accent">
                          {record.prescriptions} Rx
                        </Badge>
                      ) : null}
                    </div>
                    {vitals.length > 0 ? (
                      <p className="tabular mt-1.5 pl-28 text-xs text-ink-faint">{vitals.join(" · ")}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        </Card>

        {/* Kept visible, and kept apart. Hiding archived visits entirely would
            make the chart quietly incomplete; mixing them in would make it
            wrong. */}
        {archivedVisits.length > 0 ? (
          <details className="mt-3 rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-[13px] font-medium text-ink-muted">
              {archivedVisits.length} archived{" "}
              {archivedVisits.length === 1 ? "visit" : "visits"}
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {archivedVisits.map((record) => (
                <li key={record.id} className="transition-colors hover:bg-surface-muted">
                  <Link
                    href={`/records/${record.id}`}
                    className="flex items-baseline gap-4 px-4 py-2.5 opacity-70"
                  >
                    <span className="tabular w-24 shrink-0 text-[13px] text-ink-muted">
                      {formatDate(instantFromDb(record.visitDate))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {record.chiefComplaint || "Untitled draft"}
                    </span>
                    <Badge tone="neutral">Archived</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section>
        <SectionTitle
          title="Appointments"
          action={
            <Link
              href={`/appointments/new?patientId=${patient.id}`}
              className="font-medium text-accent-ink hover:underline"
            >
              Book
            </Link>
          }
        />
        <Card>
          <AppointmentList
            appointments={appointments}
            emptyTitle="No appointments"
            emptyDescription="Nothing booked for this patient, past or future."
          />
        </Card>
      </section>

        </div>

        {/* Standing clinical context, kept beside the timeline rather than above it. */}
        <aside className="space-y-4">
          <AlertBanner alerts={patient.alerts} />
          <AllergyBanner status={patient.allergyStatus} allergies={patient.allergies} />
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Detail label="Patient number" value={<span className="nums">{patient.patientNumber ?? "—"}</span>} />
          <Detail label="Date of birth" value={formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))} />
          <Detail label="Blood type" value={BLOOD_TYPE_LABELS[patient.bloodType]} />
          <Detail label="Contact" value={patient.contactNumber ?? patient.household.contactNumber} />
          <Detail label="Email" value={patient.email} />
          <Detail
            label="Emergency contact"
            value={
              patient.emergencyContactName ? (
                <>
                  {patient.emergencyContactName}
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {[patient.emergencyContactRelationship, patient.emergencyContactNumber]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </>
              ) : null
            }
          />
          <Detail
            className="col-span-2"
            label="Current medications"
            value={
              patient.medications.length > 0 ? (
                <ul className="space-y-0.5">
                  {patient.medications.map((m) => (
                    <li key={m.id}>
                      {m.label}
                      {[m.dosage, m.frequency].filter(Boolean).length > 0 ? (
                        <span className="text-ink-faint">
                          {" "}
                          — {[m.dosage, m.frequency].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : patient.medicationStatus === "NONE_KNOWN" ? (
                "None"
              ) : (
                <span className="text-warn-ink">Not asked</span>
              )
            }
          />
          <Detail label="Visits recorded" value={visits.length} />
          <Detail
            className="col-span-2"
            label="Chronic conditions"
            value={
              patient.conditions.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {patient.conditions.map((c) => (
                    <Badge key={c.id} tone="accent">
                      {c.label}
                    </Badge>
                  ))}
                </span>
              ) : patient.conditionStatus === "NONE_KNOWN" ? (
                "None known"
              ) : (
                <span className="text-warn-ink">Not asked</span>
              )
            }
          />
        </dl>
        {patient.conditions.some((c) => c.notes) ? (
          <dl className="mt-4 space-y-2 border-t border-border pt-4">
            {patient.conditions
              .filter((c) => c.notes)
              .map((c) => (
                <div key={c.id}>
                  <dt className="text-xs font-medium text-ink-faint">{c.label}</dt>
                  <dd className="text-sm text-pretty">{c.notes}</dd>
                </div>
              ))}
          </dl>
        ) : null}
      </Card>

        </aside>
      </div>

      <div className="lg:max-w-[calc(66.666%-0.75rem)]">
        <DangerZone
        action={deletePatient}
        fieldName="patientId"
        fieldValue={patient.id}
        summary="Delete this patient"
        warning={`This permanently removes ${fullName(patient)} along with ${patient.medicalRecords.length} medical record(s) and every appointment. It cannot be undone.`}
          confirmLabel="Delete patient and all records"
        />
      </div>
    </div>
  );
}
