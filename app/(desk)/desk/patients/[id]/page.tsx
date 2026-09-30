import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { issuePatientActivation, revokePatientActivation } from "@/app/actions/access";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { ageFrom, fullName, RELATIONSHIP_LABELS, REMINDER_LABELS, SEX_LABELS } from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { ShareCode } from "@/components/share-code";
import { activationLink, qrSvg } from "@/lib/activation-link";
import { Badge, buttonClass, Card, CardHeader, Detail, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Patient" };

/**
 * The code, just issued, handed over at the desk: the patient scans the QR in
 * the Medfave app or types the 6 digits. For later, the message carries the
 * long code (14 days). Shown this once — only hashes are kept.
 */
async function ActivationHandover({
  code,
  pin,
  patientName,
  clinicName,
  mail,
}: {
  code: string;
  pin?: string;
  patientName: string;
  clinicName: string;
  mail?: string;
}) {
  const link = await activationLink(code);
  const svg = await qrSvg(link);
  const firstName = patientName.split(/\s+/)[0];
  const mailNote =
    mail === "sent"
      ? "Also emailed to them."
      : mail === "failed"
        ? "The email didn't go through."
        : mail === "no-address"
          ? "No email on file."
          : null;

  return (
    <section className="overflow-hidden rounded-xl border border-accent/30 bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-4 bg-accent-tint px-5 py-3.5 sm:px-6">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">
          Link {firstName}&rsquo;s Medfave account
        </h2>
        <p className="shrink-0 text-xs font-medium text-accent-ink">Shown once</p>
      </div>

      <div className="grid gap-6 px-5 py-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:px-6">
        <figure className="mx-auto space-y-2 text-center sm:mx-0">
          <div
            className="size-44 rounded-lg border-2 border-brand bg-white p-2.5 [&>svg]:size-full"
            role="img"
            aria-label={`QR code that links ${patientName}'s Medfave account`}
            // Generated here from our own link by the qrcode package — no user input reaches it unescaped.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <figcaption className="text-sm text-ink-muted">Scan in the Medfave app</figcaption>
        </figure>

        <div className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-medium text-ink-muted">Or type this code</p>
          {pin ? (
            <div className="flex justify-center gap-2 sm:justify-start" aria-label={`Code ${pin.split("").join(" ")}`}>
              {pin.split("").map((d, i) => (
                <span
                  key={i}
                  className={`tabular grid h-14 w-11 place-items-center rounded-md border border-border-strong bg-surface-muted font-display text-3xl font-semibold ${i === 2 ? "mr-2" : ""}`}
                >
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className="tabular font-display text-xl font-semibold tracking-wider">{code}</p>
          )}
          <p className="text-sm text-ink-muted">{pin ? "Works for 30 minutes, once." : "Works once."}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">Not with them?</span> Send a link that lasts 14 days.
          {mailNote ? ` ${mailNote}` : ""}
        </p>
        <ShareCode code={code} link={link} clinicName={clinicName} />
      </div>
    </section>
  );
}

export default async function DeskPatientPage({
  params,
  searchParams,
}: PageProps<"/desk/patients/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { code, pin, mail } = await searchParams;

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
      "reminderPreference",
      "patientNumber",
      "accountId",
      "archivedAt",
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
      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg font-semibold text-accent-ink"
        >
          {`${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] leading-8 font-semibold tracking-[-0.015em] sm:text-[30px] sm:leading-9">
            {fullName(patient)}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))} · {patient.household.name}{" "}
            household
            {patient.patientNumber ? <span className="tabular"> · {patient.patientNumber}</span> : null}
          </p>
        </div>
        {patient.archivedAt ? null : (
          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              href={`/desk/appointments/new?patientId=${patient.id}`}
              className={buttonClass("primary", "flex-1 sm:flex-none")}
            >
              Book a visit
            </Link>
            <Link
              href={`/desk/patients/${patient.id}/edit`}
              className={buttonClass("secondary", "flex-1 sm:flex-none")}
            >
              Edit details
            </Link>
          </div>
        )}
      </header>

      {patient.archivedAt ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">This chart is archived.</p>
          <p className="mt-0.5 text-ink-muted">
            It cannot be booked or edited until the clinician restores it.
          </p>
        </div>
      ) : null}

      {/* Handed over in person, once. This is the only way a login ever reaches
          a chart, so it is issued to somebody the desk has identified. */}
      {code && typeof code === "string" ? (
        <ActivationHandover
          code={code}
          pin={typeof pin === "string" && /^\d{6}$/.test(pin) ? pin : undefined}
          patientName={fullName(patient)}
          clinicName={staff.clinicName}
          mail={typeof mail === "string" ? mail : undefined}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="min-w-0">
          <SectionTitle title="Visits" />
          <Card className="overflow-hidden">
            <AppointmentList
              appointments={appointments}
              hrefFor={(appointmentId) => `/desk/appointments/${appointmentId}`}
              emptyTitle="No visits yet"
              emptyDescription="Nothing booked for this patient."
            />
          </Card>
        </section>

        <div className="space-y-6">
        <Card>
          <CardHeader title="Medfave account" subtitle="Lets them see their visits and ask for times." />
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
                <span className="text-sm text-ink-muted">
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
                  <button className={buttonClass("primary")}>Link their account</button>
                </form>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Contact details" />
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-1">
            <Detail label="Date of birth" value={formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))} />
            <Detail label="Relationship" value={RELATIONSHIP_LABELS[patient.relationship]} />
            <Detail label="Mobile" value={patient.contactNumber} />
            <Detail label="Email" value={patient.email} />
            {/* The patient's own standing choice, set from their portal. New
                bookings take it as their default. */}
            <Detail label="Reminders" value={REMINDER_LABELS[patient.reminderPreference]} />
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

        </div>
      </div>
    </div>
  );
}

/** The stored value is already a database timestamp; this only proves it is set. */
function instantToDbSafe(value: string | null) {
  return value ?? null;
}
