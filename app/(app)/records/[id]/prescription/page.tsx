import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDoctor } from "@/lib/auth";
import { clinicLetterhead } from "@/lib/clinic";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, instantFromDb } from "@/lib/datetime";
import { formatCalendarDate, formatDate } from "@/lib/datetime";
import { ageFrom, fullName, SEX_LABELS } from "@/lib/domain";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Prescription" };

export default async function PrescriptionPage({ params }: PageProps<"/records/[id]/prescription">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const clinic = await clinicLetterhead(doctor.clinicId);

  const record = await orm.MedicalRecord
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "patientNumber")
        .include("allergies", (a) => a.select("id", "label", "severity")),
    )
    .include("prescriptions", (rx) =>
      rx
        .select("id", "drugName", "dosage", "frequency", "duration", "instructions")
        .orderBy((x) => x.createdAt.asc()),
    )
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!record) notFound();

  const { patient } = record;
  const visitDate = instantFromDb(record.visitDate);

  return (
    <div className="space-y-5">
      {/* Screen-only controls; the sheet below is what prints. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prescription</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {fullName(patient)} · {formatDate(visitDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Link
            href={`/records/${record.id}`}
            className="inline-flex items-center rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Back to record
          </Link>
        </div>
      </div>

      {record.prescriptions.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-center text-sm text-ink-muted print:hidden">
          This visit has no prescriptions. Add them by editing the record.
        </p>
      ) : (
        <article className="prescription-sheet mx-auto w-full max-w-[210mm] rounded-xl border border-border bg-white p-10 text-black shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
            <div>
              <p className="text-lg font-semibold">{doctor.fullName}</p>
              {doctor.specialty ? <p className="text-sm">{doctor.specialty}</p> : null}
              {clinic.name ? <p className="text-sm">{clinic.name}</p> : null}
              {clinic.address ? <p className="text-sm">{clinic.address}</p> : null}
              {clinic.contactNumber ? <p className="text-sm">Tel. {clinic.contactNumber}</p> : null}
              {doctor.licenseNumber ? (
                <p className="mt-1 text-xs">PRC License No. {doctor.licenseNumber}</p>
              ) : null}
            </div>
            <p className="text-right text-sm">
              <span className="block font-medium">Date</span>
              {formatDate(visitDate)}
            </p>
          </header>

          <section className="grid grid-cols-2 gap-x-8 gap-y-1 border-b border-black/30 py-4 text-sm">
            <p>
              <span className="font-medium">Patient:</span> {fullName(patient)}
            </p>
            <p>
              <span className="font-medium">Patient no.:</span> {patient.patientNumber ?? "—"}
            </p>
            <p>
              <span className="font-medium">Age / Sex:</span> {ageFrom(calendarDateFromDb(patient.dateOfBirth), visitDate)}{" "}
              / {SEX_LABELS[patient.sex]}
            </p>
            <p className="col-span-2">
              <span className="font-medium">Date of birth:</span>{" "}
              {formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))}
            </p>
            {patient.allergies.length > 0 ? (
              <p className="col-span-2 mt-1 font-medium">
                Allergies: {patient.allergies.map((a) => a.label).join(", ")}
              </p>
            ) : null}
          </section>

          {/* The ℞ symbol is the conventional mark on a prescription. */}
          <section className="py-6">
            <p className="mb-4 font-serif text-4xl leading-none">℞</p>
            <ol className="space-y-5">
              {record.prescriptions.map((rx, i) => (
                <li key={rx.id} className="text-sm">
                  <p className="font-semibold">
                    {i + 1}. {rx.drugName}
                  </p>
                  <p className="pl-5">
                    {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                  </p>
                  {rx.instructions ? <p className="pl-5 italic">{rx.instructions}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          <footer className="mt-10 flex justify-end">
            <div className="w-64 border-t border-black pt-2 text-center text-sm">
              <p className="font-medium">{doctor.fullName}</p>
              {doctor.licenseNumber ? <p className="text-xs">Lic. No. {doctor.licenseNumber}</p> : null}
            </div>
          </footer>
        </article>
      )}
    </div>
  );
}
