import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { issuePatientActivation, revokePatientActivation } from "@/app/actions/access";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { ageFrom, fullName, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { Badge, buttonClass, Card, CardHeader, Detail, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Patient" };

export default async function DeskPatientPage({
  params,
  searchParams,
}: PageProps<"/desk/patients/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { code, mail } = await searchParams;

  const patient = await orm.Patient
    .select(
      "id",
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "sex",
      "relationship",
      "contactNumber",
      "email",
      "patientNumber",
      "accountId",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactNumber",
    )
    .include("household", (h) => h.select("id", "name", "address", "contactNumber"))
    .include("appointments", (a) =>
      a
        .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "priority", "visitType")
        .include("patient", (p) =>
          p.select("id", "firstName", "middleName", "lastName").include("household", (h) => h.select("id", "name")),
        )
        .include("medicalRecord", (r) => r.select("id"))
        .orderBy((x) => x.scheduledAt.desc())
        .limit(20),
    )
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient) notFound();

  const appointments = patient.appointments.map((a) => ({
    ...a,
    scheduledAt: instantFromDb(a.scheduledAt),
  }));

  const activation = await orm.PatientActivation
    .select("id", "expiresAt", "usedAt", "revokedAt", "createdAt")
    .where((a) => a.patientId.eq(patient.id))
    .where((a) => a.clinicId.eq(staff.clinicId))
    .orderBy((a) => a.createdAt.desc())
    .first();
  const live =
    activation && !activation.usedAt && !activation.revokedAt
      ? instantToDbSafe(activation.expiresAt)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName(patient)}
        subtitle={
          <>
            {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))} ·{" "}
            {patient.household.name} household
            {patient.patientNumber ? ` · ${patient.patientNumber}` : ""}
          </>
        }
        actions={
          <>
            <Link
              href={`/desk/appointments/new?patientId=${patient.id}`}
              className={buttonClass("primary")}
            >
              Book
            </Link>
            <Link href={`/desk/patients/${patient.id}/edit`} className={buttonClass("secondary")}>
              Edit details
            </Link>
          </>
        }
      />

      {/* Handed over in person, once. This is the only way a login ever reaches
          a chart, so it is issued to somebody the desk has identified. */}
      {code ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3">
          <p className="text-[13px] font-medium text-ok-ink">
            Activation code — write it down now, it is not shown again.
          </p>
          <p className="tabular mt-1 text-lg font-semibold tracking-wider">{code}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Give it to {fullName(patient)} in person. They enter it at the sign-up page to connect a
            login to this record.{" "}
            {mail === "sent" ? (
            <>Also emailed to them.</>
          ) : mail === "failed" ? (
            <>The email could not be sent, so this code is the only copy — pass it on directly.</>
          ) : mail === "no-address" ? (
            <>No email address on file, so this code is the only copy.</>
          ) : (
            <>Email is not set up, so this code is the only copy.</>
          )}
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Contact details" />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Detail label="Date of birth" value={formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))} />
          <Detail label="Relationship" value={RELATIONSHIP_LABELS[patient.relationship]} />
          <Detail label="Mobile" value={patient.contactNumber} />
          <Detail label="Email" value={patient.email} />
          <Detail label="Household address" value={patient.household.address} />
          <Detail label="Household number" value={patient.household.contactNumber} />
          <Detail label="Emergency contact" value={patient.emergencyContactName} />
          <Detail
            label="Emergency number"
            value={
              patient.emergencyContactNumber
                ? `${patient.emergencyContactNumber}${patient.emergencyContactRelationship ? ` (${patient.emergencyContactRelationship})` : ""}`
                : null
            }
          />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Portal access"
          subtitle="Whether this person can sign in and see their own appointments."
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          {patient.accountId ? (
            <Badge dot tone="ok">
              Account active
            </Badge>
          ) : live ? (
            <>
              <Badge dot tone="accent">
                Code issued
              </Badge>
              <span className="text-[13px] text-ink-muted">
                Expires {formatDateTime(instantFromDb(activation!.expiresAt))}
              </span>
              <form action={revokePatientActivation}>
                <input type="hidden" name="patientId" value={patient.id} />
                <button className={buttonClass("secondary")}>Revoke</button>
              </form>
            </>
          ) : (
            <>
              <Badge tone="neutral">No account</Badge>
              <form action={issuePatientActivation}>
                <input type="hidden" name="patientId" value={patient.id} />
                <button className={buttonClass("secondary")}>Issue activation code</button>
              </form>
            </>
          )}
        </div>
      </Card>

      <section>
        <CardHeader title="Appointments" />
        <Card className="overflow-hidden">
          <AppointmentList
            appointments={appointments}
            hrefFor={(appointmentId) => `/desk/appointments/${appointmentId}`}
            emptyTitle="No appointments"
            emptyDescription="Nothing booked for this patient."
          />
        </Card>
      </section>
    </div>
  );
}

/** The stored value is already a database timestamp; this only proves it is set. */
function instantToDbSafe(value: string | null) {
  return value ?? null;
}
