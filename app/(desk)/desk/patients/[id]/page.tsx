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
import { Badge, buttonClass, Card, CardHeader, Detail, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Patient" };

/**
 * The code, just issued, and three ways to get it to the patient: scan the QR
 * code with their phone, share it to Viber or Messenger from the clinic's
 * phone, or read it out. It is shown this once — only its hash is kept.
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

  return (
    <div className="rounded-lg border border-ok/40 bg-ok-tint p-4 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div
          className="size-44 shrink-0 self-center rounded-md bg-white p-2 sm:self-start [&>svg]:size-full"
          role="img"
          aria-label={`QR code that opens Medfave's activation page with ${patientName}'s code filled in`}
          // Generated here from our own link by the qrcode package — no user input reaches it unescaped.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-ok-ink">
              Hand it over now — it is not shown again.
            </p>
            {pin ? (
              <>
                <p className="tabular mt-1 text-4xl font-semibold tracking-[0.2em]">
                  {pin.slice(0, 3)} {pin.slice(3)}
                </p>
                <p className="text-xs text-ink-muted">6-digit code · works for 30 minutes</p>
              </>
            ) : (
              <p className="tabular mt-1 text-xl font-semibold tracking-wider">{code}</p>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            {patientName} scans the QR code in the Medfave app (Scan a clinic&rsquo;s QR code) or with their phone
            camera. Or they type the 6-digit code in the app. To send it later, share the message: it carries a
            longer code that lasts 14 days.
          </p>
          <ShareCode code={code} link={link} clinicName={clinicName} />
          <p className="text-xs text-ink-muted">
            {mail === "sent" ? (
              <>Also emailed to them.</>
            ) : mail === "failed" ? (
              <>The email could not be sent, so pass it on here.</>
            ) : mail === "no-address" ? (
              <>No email address on file, so pass it on here.</>
            ) : (
              <>Email is not set up, so pass it on here.</>
            )}{" "}
            The QR code and the message work once, for 14 days.
          </p>
        </div>
      </div>
    </div>
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
          patient.archivedAt ? null : (
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
          )
        }
      />

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

      <Card>
        <CardHeader title="Contact details" />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
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
