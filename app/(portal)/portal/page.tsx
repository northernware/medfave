import type { Metadata } from "next";
import Link from "next/link";
import { withdrawRequest } from "@/app/actions/requests";
import { requirePatientAccount } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import {
  calendarDateFromDb,
  formatCalendarDate,
  formatDate,
  dayKey,
  formatDateTime,
  formatTime,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  SERVICE_LABELS,
} from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { RatingFace } from "@/components/rating-face";
import { SCORE_WORDS } from "@/lib/faves";
import { Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader, Stat, StatStrip } from "@/components/ui";

export const metadata: Metadata = { title: "My clinic" };

export default async function PortalPage({ searchParams }: PageProps<"/portal">) {
  const me = await requirePatientAccount();
  const { requested, added } = await searchParams;
  const now = instantToDb(new Date());

  // Every query below is scoped to this one patient id, which came from the
  // account's own link. Nothing here takes an id from the request.
  const [profile, upcoming, past, requests, documents, feedback] = await Promise.all([
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
      .select("id", "preferredDate", "preferredTime", "service", "reason", "status", "decisionNote", "rescheduleOfId")
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
    // What this login said about its visits, to show the face it gave.
    orm.VisitFeedback.select("appointmentId", "score").where((f) => f.accountId.eq(me.accountId)).all(),
  ]);

  if (!profile) return null;

  // As the app: live visits lead, the next one as the pink card; called-off ones fold away.
  const live = upcoming.filter((a) => !ENDED.includes(a.status));
  const calledOff = upcoming.filter((a) => ENDED.includes(a.status));
  const next = live[0];
  // Requests still waiting first, then the latest few answers.
  const waiting = requests.filter((r) => r.status === "PENDING");
  const answered = requests.filter((r) => r.status !== "PENDING").slice(0, Math.max(0, 4 - waiting.length));
  const moving = new Map(upcoming.map((a) => [a.id, a]));
  const rated = new Map(feedback.map((f) => [f.appointmentId, f.score]));

  const nextAt = next ? instantFromDb(next.scheduledAt) : null;

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Hello, ${profile.firstName}`}
        subtitle={`${profile.household.name} household${profile.patientNumber ? ` · ${profile.patientNumber}` : ""}`}
        actions={
          <Link href="/portal/request" className={buttonClass("primary")}>
            Request a visit
          </Link>
        }
      />

      {added ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
          <p className="font-medium text-ok-ink">{me.clinicName} is now linked to your account.</p>
          <p className="mt-0.5 text-ink-muted">Switch between your clinics at the top of the page.</p>
        </div>
      ) : null}
      {requested ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
          <p className="font-medium text-ok-ink">Your request has been sent.</p>
          <p className="mt-0.5 text-ink-muted">The clinic will confirm a time. Until they do, the slot is not held for you.</p>
        </div>
      ) : null}

      {/* The figures strip the doctor's Today has, for one person. */}
      <StatStrip>
        <Stat
          label="Next visit"
          value={nextAt ? howSoon(nextAt) : "—"}
          hint={next && nextAt ? `${formatDateTime(nextAt)} · ${SERVICE_LABELS[next.service]}` : "Nothing booked"}
        />
        <Stat label="Upcoming" value={live.length} hint={live.length === 1 ? "visit" : "visits"} />
        <Stat label="Waiting for the clinic" value={waiting.length} hint={waiting.length === 1 ? "request" : "requests"} />
        <Stat label="Documents" value={documents.length} hint="shared with you" />
      </StatStrip>

      <Card>
        <CardHeader title="Upcoming visits" />
        {live.length === 0 ? (
          <EmptyState title="Nothing booked" description="Ask the clinic for a time. It shows here once they confirm it." />
        ) : (
          <ul className="divide-y divide-border">
            {live.map((a) => {
              const at = instantFromDb(a.scheduledAt);
              const status = statusWord(a.status);
              return (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{formatDateTime(at)}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {SERVICE_LABELS[a.service]} · {a.doctor.fullName}
                    </span>
                  </span>
                  <span className="text-sm text-ink-faint">{howSoon(at)}</span>
                  {status ? (
                    <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                      {status}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {calledOff.length > 0 ? (
          <details className="group border-t border-border">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm text-ink-muted hover:text-ink">
              {calledOff.length} cancelled or missed <span className="group-open:hidden">· Show</span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {calledOff.map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 px-5 py-2.5 text-sm text-ink-muted">
                  <span className="min-w-0 flex-1 truncate">
                    {formatDateTime(instantFromDb(a.scheduledAt))} · {SERVICE_LABELS[a.service]}
                  </span>
                  <Badge>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      {waiting.length + answered.length > 0 ? (
        <Card>
          <CardHeader title="Your requests" subtitle="A request isn't a booking until the clinic confirms a time." />
          <ul className="divide-y divide-border">
            {[...waiting, ...answered].map((r) => {
              const from = r.rescheduleOfId ? moving.get(r.rescheduleOfId) : undefined;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {r.rescheduleOfId ? "Move to " : ""}
                      {formatCalendarDate(calendarDateFromDb(r.preferredDate))}
                      {r.preferredTime ? ` at ${formatClock(r.preferredTime)}` : " · any time"}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {SERVICE_LABELS[r.service]}
                      {from ? ` · now ${formatDateTime(instantFromDb(from.scheduledAt))}` : ` · ${r.reason}`}
                    </span>
                    {r.decisionNote ? (
                      <span className="mt-1 block text-sm">
                        <span className="text-ink-muted">From the clinic:</span> {r.decisionNote}
                      </span>
                    ) : null}
                  </span>
                  <Badge dot tone={REQUEST_TONE[r.status] ?? "neutral"}>
                    {REQUEST_WORDS[r.status] ?? r.status}
                  </Badge>
                  {r.status === "PENDING" ? (
                    <form action={withdrawRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button className="text-sm font-medium whitespace-nowrap text-ink-muted hover:text-ink">
                        {r.rescheduleOfId ? "Keep my current time" : "Withdraw"}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card>
          <CardHeader title="Documents shared with you" />
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id}>
                <Link href={`/portal/documents/${d.id}`} className="flex items-baseline gap-3 px-5 py-3 hover:bg-surface-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                    <span className="block truncate text-sm text-ink-muted">{d.purpose}</span>
                  </span>
                  <span className="text-sm font-medium text-accent-ink">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {past.length > 0 ? (
        <Card>
          <CardHeader title="Past visits" subtitle="Notes from your visits are held by the clinic. Rate a visit in the app." />
          <ul className="divide-y divide-border">
            {past.map((a) => {
              const score = rated.get(a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                  <span className="tabular w-36 shrink-0 text-sm">{formatDate(instantFromDb(a.scheduledAt))}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {SERVICE_LABELS[a.service]} · {a.doctor.fullName}
                  </span>
                  {score ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <RatingFace score={score} size={20} />
                      {SCORE_WORDS[score]}
                    </span>
                  ) : a.status !== "COMPLETED" ? (
                    <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

/** Statuses that are over without the visit happening. */
const ENDED: string[] = ["CANCELLED", "NO_SHOW"];
const REQUEST_TONE: Record<string, "ok" | "warn" | "neutral"> = { PENDING: "warn", ACCEPTED: "ok" };
const REQUEST_WORDS: Record<string, string> = {
  PENDING: "Waiting for the clinic",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

/** Only the unusual is said: confirmed goes unsaid. */
function statusWord(status: string) {
  return status === "CONFIRMED" ? null : APPOINTMENT_STATUS_LABELS[status as keyof typeof APPOINTMENT_STATUS_LABELS];
}

/** "Today", "Tomorrow", "In 3 days", "In 2 weeks", "In 4 months", in clinic days, as the app. */
function howSoon(at: Date) {
  const days = Math.round((Date.parse(`${dayKey(at)}T00:00:00Z`) - Date.parse(`${dayKey(new Date())}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 56) return `In ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.4);
  return `In ${months} month${months === 1 ? "" : "s"}`;
}

/** "14:30" as the clinic's clock face, "2:30 PM". */
function formatClock(hhmm: string) {
  return formatTime(new Date(`2000-01-01T${hhmm}:00+08:00`));
}
