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
  SERVICE_LABELS,
} from "@/lib/domain";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { ReactNode } from "react";
import { HeartMark } from "@/components/brand";
import { RatingFace } from "@/components/rating-face";
import { SCORE_WORDS } from "@/lib/faves";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";

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
  const [next, ...later] = live;
  // Requests still waiting first, then the latest few answers.
  const waiting = requests.filter((r) => r.status === "PENDING");
  const answered = requests.filter((r) => r.status !== "PENDING").slice(0, Math.max(0, 4 - waiting.length));
  const moving = new Map(upcoming.map((a) => [a.id, a]));
  const rated = new Map(feedback.map((f) => [f.appointmentId, f.score]));

  return (
    <div className="space-y-5">
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

      {next ? (
        <section className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-white shadow-card">
          <HeartMark tone="white" className="pointer-events-none absolute -top-8 -right-10 size-40 opacity-15" />
          <p className="text-xs font-semibold tracking-[0.12em] uppercase opacity-85">
            {["Next visit", statusWord(next.status), howSoon(instantFromDb(next.scheduledAt))].filter(Boolean).join(" · ")}
          </p>
          <h2 className="mt-2 font-heading text-[28px] leading-tight font-semibold">{SERVICE_LABELS[next.service]}</h2>
          <p className="mt-1 text-sm opacity-90">with {next.doctor.fullName}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill onHero>{formatDate(instantFromDb(next.scheduledAt))}</Pill>
            <Pill onHero>{formatTime(instantFromDb(next.scheduledAt))}</Pill>
          </div>
        </section>
      ) : (
        <Card>
          <EmptyState title="Nothing booked" description="Ask the clinic for a time. It shows here once they confirm it." />
        </Card>
      )}

      {later.length > 0 || calledOff.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Upcoming</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
          {later.map((a) => (
            <VisitCard
              key={a.id}
              eyebrow={[statusWord(a.status), howSoon(instantFromDb(a.scheduledAt))].filter(Boolean).join(" · ")}
              title={SERVICE_LABELS[a.service]}
              doctor={a.doctor.fullName}>
              <div className="flex flex-wrap gap-2">
                <Pill>{formatDate(instantFromDb(a.scheduledAt))}</Pill>
                <Pill>{formatTime(instantFromDb(a.scheduledAt))}</Pill>
              </div>
            </VisitCard>
          ))}
          </div>
          {calledOff.length > 0 ? (
            <details className="group rounded-2xl border border-border bg-surface">
              <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium">
                {calledOff.length} cancelled or missed <span className="text-ink-muted group-open:hidden">· Show</span>
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {calledOff.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 px-5 py-3 text-sm text-ink-muted">
                    <span className="flex-1">
                      {formatDateTime(instantFromDb(a.scheduledAt))} · {SERVICE_LABELS[a.service]}
                    </span>
                    <Badge>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {waiting.length + answered.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Requests</SectionTitle>
          <div className="grid gap-2 md:grid-cols-2">
          {[...waiting, ...answered].map((r) => {
            const from = r.rescheduleOfId ? moving.get(r.rescheduleOfId) : undefined;
            return (
              <VisitCard
                key={r.id}
                eyebrow={`${r.rescheduleOfId ? "Move · " : ""}${REQUEST_WORDS[r.status] ?? r.status}`}
                title={SERVICE_LABELS[r.service]}
                quiet={r.status === "DECLINED" || r.status === "WITHDRAWN"}
                corner={
                  r.status === "PENDING" ? (
                    <form action={withdrawRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button className="text-sm font-medium whitespace-nowrap text-ink-muted hover:text-ink">
                        {r.rescheduleOfId ? "Keep my current time" : "Withdraw"}
                      </button>
                    </form>
                  ) : null
                }>
                {from ? (
                  <p className="text-sm text-ink-muted">From {formatDateTime(instantFromDb(from.scheduledAt))}, to:</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Pill>{formatCalendarDate(calendarDateFromDb(r.preferredDate))}</Pill>
                  <Pill>{r.preferredTime ? formatClock(r.preferredTime) : "Any time"}</Pill>
                </div>
                {r.decisionNote ? (
                  <div className="rounded-xl bg-surface-muted px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">From the clinic</p>
                    <p className="mt-1 text-sm">{r.decisionNote}</p>
                  </div>
                ) : null}
              </VisitCard>
            );
          })}
          </div>
        </section>
      ) : null}

      {documents.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>From your clinic</SectionTitle>
          <Card>
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id}>
                  <Link href={`/portal/documents/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-muted">
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
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Past visits</SectionTitle>
          <Card>
            <ul className="divide-y divide-border">
              {past.map((a) => {
                const score = rated.get(a.id);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">
                        {formatDateTime(instantFromDb(a.scheduledAt))}
                      </span>
                      <span className={`block text-sm font-medium ${ENDED.includes(a.status) ? "text-ink-muted" : ""}`}>
                        {SERVICE_LABELS[a.service]} · {a.doctor.fullName}
                      </span>
                    </span>
                    {score ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent-tint py-1 pr-3 pl-1 text-sm font-medium">
                        <RatingFace score={score} size={22} /> {SCORE_WORDS[score]}
                      </span>
                    ) : ENDED.includes(a.status) ? (
                      <Badge>{a.status === "NO_SHOW" ? "Missed" : "Cancelled"}</Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/** Statuses that are over without the visit happening. */
const ENDED: string[] = ["CANCELLED", "NO_SHOW"];
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

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-2 font-heading text-lg font-semibold">{children}</h2>;
}

function Pill({ children, onHero = false }: { children: ReactNode; onHero?: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-3 py-1.5 text-sm font-semibold",
        onHero ? "bg-white/15 text-white" : "bg-accent-tint text-ink",
      ].join(" ")}>
      {children}
    </span>
  );
}

/** The app's white visit card: a top line and a corner, the service, who it's with, then the rest. */
function VisitCard({
  eyebrow,
  title,
  doctor,
  corner,
  quiet = false,
  children,
}: {
  eyebrow: string;
  title: string;
  doctor?: string;
  corner?: ReactNode;
  quiet?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className="space-y-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{eyebrow}</p>
        {corner}
      </div>
      <h3 className={`font-heading text-lg font-semibold ${quiet ? "text-ink-muted" : ""}`}>{title}</h3>
      {doctor ? <p className="text-sm text-ink-muted">with {doctor}</p> : null}
      {children}
    </Card>
  );
}
