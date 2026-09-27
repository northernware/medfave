import type { Metadata } from "next";
import Link from "next/link";
import { withdrawRequest } from "@/app/actions/requests";
import { requirePatientAccount } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import {
  calendarDateFromDb,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  fullName,
  SERVICE_LABELS,
} from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { Badge, buttonClass, Card, CardHeader, Detail, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My clinic" };

export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const me = await requirePatientAccount();
  const { requested } = await searchParams;
  const now = instantToDb(new Date());

  // Every query below is scoped to this one patient id, which came from the
  // account's own link. Nothing here takes an id from the request.
  const [profile, upcoming, past, requests, documents] = await Promise.all([
    orm.Patient
      .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "patientNumber", "contactNumber", "email")
      .include("household", (h) => h.select("name"))
      .where((p) => p.id.eq(me.patientId))
      .first(),
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "visitType")
      .include("doctor", (d) => d.select("fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(20)
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "service", "reason", "status")
      .include("doctor", (d) => d.select("fullName"))
      .where((a) => a.patientId.eq(me.patientId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(10)
      .all(),
    orm.AppointmentRequest
      .select("id", "preferredDate", "preferredTime", "service", "reason", "status", "decisionNote")
      .where((r) => r.patientId.eq(me.patientId))
      .orderBy((r) => r.createdAt.desc())
      .limit(10)
      .all(),
    // Only what the clinic chose to publish here. A document being released at
    // the desk is not the same act as showing it in a portal.
    orm.DocumentRequest
      .select("id", "type", "purpose", "sharedWithPatientAt")
      .where((d) => d.patientId.eq(me.patientId))
      .where((d) => d.sharedWithPatientAt.isNotNull())
      .orderBy((d) => d.sharedWithPatientAt.desc())
      .all(),
  ]);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${profile.firstName}`}
        subtitle={`${profile.household.name} household${profile.patientNumber ? ` · ${profile.patientNumber}` : ""}`}
        actions={
          <Link href="/portal/request" className={buttonClass("primary")}>
            Request an appointment
          </Link>
        }
      />

      {requested ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
          <p className="font-medium text-ok-ink">Your request has been sent.</p>
          <p className="mt-0.5 text-ink-muted">
            The clinic will confirm a time. Until they do, the slot is not held for you.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Upcoming appointments" />
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nothing booked"
            description="Ask the clinic for a time and it will appear here once they confirm it."
          />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {formatDateTime(instantFromDb(a.scheduledAt))}
                  </span>
                  <span className="block truncate text-sm text-ink-muted">
                    {SERVICE_LABELS[a.service]} · {a.doctor.fullName}
                  </span>
                </span>
                <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {requests.length > 0 ? (
        <Card>
          <CardHeader
            title="Your requests"
            subtitle="A request is not a booking — the clinic confirms a time before it is yours."
          />
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {formatCalendarDate(calendarDateFromDb(r.preferredDate))}
                    {r.preferredTime ? ` at ${r.preferredTime}` : " · any time"}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {SERVICE_LABELS[r.service]} · {r.reason}
                    {r.decisionNote ? ` — ${r.decisionNote}` : ""}
                  </span>
                </span>
                <Badge
                  tone={
                    r.status === "ACCEPTED" ? "ok" : r.status === "PENDING" ? "warn" : "neutral"
                  }
                >
                  {r.status === "ACCEPTED"
                    ? "Booked"
                    : r.status === "PENDING"
                      ? "Waiting"
                      : r.status === "DECLINED"
                        ? "Declined"
                        : "Withdrawn"}
                </Badge>
                {r.status === "PENDING" ? (
                  <form action={withdrawRequest}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button className="text-xs font-medium text-ink-muted hover:text-ink">
                      Withdraw
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card>
          <CardHeader title="Documents shared with you" />
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {DOCUMENT_TYPE_LABELS[d.type]}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{d.purpose}</span>
                </span>
                <Link
                  href={`/portal/documents/${d.id}`}
                  className="text-sm font-medium text-accent-ink hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Your details"
          subtitle="Your contact details are yours to correct; the rest is held by the clinic."
          action={
            <Link href="/portal/details" className={buttonClass("secondary", "text-xs")}>
              Update
            </Link>
          }
        />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Detail label="Name" value={fullName(profile)} />
          <Detail
            label="Date of birth"
            value={formatCalendarDate(calendarDateFromDb(profile.dateOfBirth))}
          />
          <Detail label="Mobile" value={profile.contactNumber} />
          <Detail label="Email" value={profile.email} />
        </dl>
      </Card>

      {past.length > 0 ? (
        <Card>
          <CardHeader title="Past visits" subtitle="Notes from your visits are held by the clinic." />
          <ul className="divide-y divide-border">
            {past.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-2.5">
                <span className="tabular w-32 shrink-0 text-sm">
                  {formatDate(instantFromDb(a.scheduledAt))}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                  {SERVICE_LABELS[a.service]} · {a.doctor.fullName}
                </span>
                <Badge tone={APPOINTMENT_STATUS_TONE[a.status]}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
