import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { sweepNoShows } from "@/lib/no-show";
import { sendDueReminders } from "@/lib/reminders";
import { clinicDoctors } from "@/lib/clinic";
import {
  CLINIC_TIME_ZONE,
  clinicDayRange,
  formatDayHeading,
  formatTime,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import {
  ACTIVE_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  fullName,
  QUEUE_STATUSES,
  SERVICE_LABELS,
} from "@/lib/domain";
import { Badge, buttonClass, Card, EmptyState, SectionTitle } from "@/components/ui";
import { HeartMark } from "@/components/brand";

export const metadata: Metadata = { title: "Front desk" };

/** Whole minutes between two moments — the number the desk is asked for. */
function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

export default async function DeskPage() {
  const staff = await requireStaff();
  const now = new Date();
  const today = clinicDayRange(now);

  // Same assumption the clinical dashboard makes, for the same reason: a
  // booking nobody has spoken for long past its time is not still to come.
  for (const doctor of await clinicDoctors(staff.clinicId)) {
    await sweepNoShows(doctor.id, now);
  }
  await sendDueReminders(staff.clinicId, now);

  const [todaysRows, queueRows, pendingRequests] = await Promise.all([
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "room")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName", "contactNumber"))
      .include("doctor", (d) => d.select("id", "fullName"))
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.scheduledAt.gte(instantToDb(today.start)))
      .where((a) => a.scheduledAt.lt(instantToDb(today.end)))
      .orderBy((a) => a.scheduledAt.asc())
      .all(),
    orm.Appointment
      .select("id", "scheduledAt", "service", "reason", "arrivedAt", "consultationStartedAt", "status")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.clinicId.eq(staff.clinicId))
      .where((a) => a.status.in(QUEUE_STATUSES))
      .all(),
    orm.AppointmentRequest
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.eq("PENDING"))
      .aggregate((agg) => ({ n: agg.count() })),
  ]);

  const todays = todaysRows.map((a) => ({ ...a, scheduledAt: instantFromDb(a.scheduledAt) }));
  const queue = queueRows
    .map((a) => ({
      ...a,
      scheduledAt: instantFromDb(a.scheduledAt),
      arrivedAt: a.arrivedAt ? instantFromDb(a.arrivedAt) : null,
      consultationStartedAt: a.consultationStartedAt
        ? instantFromDb(a.consultationStartedAt)
        : null,
    }))
    .sort((a, b) => (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0));

  const waiting = queue.filter((a) => a.status === "CHECKED_IN");
  const seeing = queue.filter((a) => a.status === "IN_CONSULTATION");
  const remaining = todays.filter(
    (a) => ACTIVE_STATUSES.includes(a.status) && a.scheduledAt >= now,
  ).length;

  return (
    <div className="space-y-6">
      {/* The day at a glance, in the brand's colours — the same greeting the app opens with. */}
      <section className="relative overflow-hidden rounded-xl bg-brand px-5 py-6 text-white sm:px-8 sm:py-8">
        <HeartMark tone="white" className="pointer-events-none absolute -top-6 -right-2 size-20 opacity-15 sm:-top-4 sm:right-6 sm:size-28" />
        <HeartMark tone="white" className="pointer-events-none absolute right-40 bottom-3 hidden size-12 opacity-15 sm:block" />
        <p className="text-sm font-medium text-white/85">{formatDayHeading(now)}</p>
        <h1 className="mt-1 font-display text-[28px] leading-9 font-semibold tracking-[-0.015em] sm:text-[34px] sm:leading-10">
          {greeting(now)}, {staff.fullName.split(/\s+/)[0]}
        </h1>
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
          <HeroStat label="Today" value={todays.length} hint={remaining > 0 ? `${remaining} to come` : "All done"} />
          <HeroStat
            label="Waiting"
            value={waiting.length}
            hint={seeing.length > 0 ? `${seeing.length} with doctor` : "Nobody yet"}
          />
          <HeroStat
            label="Requests"
            value={pendingRequests.n}
            hint={pendingRequests.n > 0 ? "To answer" : "None"}
            href={pendingRequests.n > 0 ? "/desk/requests" : undefined}
          />
        </dl>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ActionTile
          href="/desk/appointments/new?source=WALK_IN"
          label="Walk-in"
          icon="M13 4a2 2 0 11-4 0 2 2 0 014 0zM9 21l2-6 3 2v4M8 12l3-4 3 2 3 1M11 8l-2 5"
          primary
        />
        <ActionTile href="/desk/appointments/new" label="Book" icon="M8 3v4M16 3v4M4 9h16M5 5h14v16H5zM12 13v4M10 15h4" />
        <ActionTile href="/desk/patients/new" label="Add patient" icon="M10 11a4 4 0 100-8 4 4 0 000 8zM3 21v-1a7 7 0 0111.5-5.4M19 14v6M16 17h6" />
      </div>

      {queue.length > 0 ? (
        <section>
          <SectionTitle title="Waiting room" hint="Here now — waiting or with the doctor" />
          <Card raised className="divide-y divide-border border-warn/40">
            {queue.map((a) => {
              const withDoctor = a.status === "IN_CONSULTATION";
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="nums w-16 shrink-0 text-sm font-medium">
                    {formatTime(a.arrivedAt ?? a.scheduledAt)}
                    {a.arrivedAt ? (
                      <span className="tabular block font-sans text-xs font-normal text-ink-muted">
                        {withDoctor
                          ? `waited ${minutesBetween(a.arrivedAt, a.consultationStartedAt ?? now)}m`
                          : `waiting ${minutesBetween(a.arrivedAt, now)}m`}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/desk/appointments/${a.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {fullName(a.patient)}
                    </Link>
                    <span className="block truncate text-xs text-ink-muted">
                      {SERVICE_LABELS[a.service]} · {a.reason}
                    </span>
                  </span>
                  {withDoctor ? (
                    <Badge dot tone="accent">
                      In consultation
                    </Badge>
                  ) : (
                    <Badge dot tone="warn">
                      Waiting
                    </Badge>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle
          title="Today's schedule"
          action={
            <Link href="/desk/appointments" className="font-medium text-accent-ink hover:underline">
              All appointments
            </Link>
          }
        />
        <Card>
          {todays.length === 0 ? (
            <EmptyState title="A clear day" description="Nothing booked for today." />
          ) : (
            <ul className="divide-y divide-border">
              {todays.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="nums w-16 shrink-0 text-sm font-medium">
                    {formatTime(a.scheduledAt)}
                  </span>
                  <Link href={`/desk/appointments/${a.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {fullName(a.patient)}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {a.doctor.fullName} · {a.reason}
                      {a.patient.contactNumber ? ` · ${a.patient.contactNumber}` : ""}
                    </span>
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                    {/* Checking somebody in is the desk's own move. Starting the
                        consultation is not, and is not offered here. */}
                    {a.status === "PENDING" || a.status === "CONFIRMED" ? (
                      <form action={setAppointmentStatus}>
                        <input type="hidden" name="appointmentId" value={a.id} />
                        <input type="hidden" name="status" value="CHECKED_IN" />
                        <button className={buttonClass("secondary")}>Check in</button>
                      </form>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

/** Good morning / afternoon / evening, by the clinic's clock. */
function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: CLINIC_TIME_ZONE }).format(now));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function HeroStat({ label, value, hint, href }: { label: string; value: number; hint: string; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-medium text-white/80">{label}</dt>
      <dd className="nums mt-1 font-display text-[28px] leading-none font-semibold">{value}</dd>
      <dd className="mt-1 truncate text-xs text-white/80">{hint}</dd>
    </>
  );
  const box = "block rounded-lg bg-white/15 px-3 py-3 sm:px-4";
  return href ? (
    <Link href={href} className={`${box} transition-colors hover:bg-white/25`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** One of the desk's three everyday moves, as a big target that works on a phone. */
function ActionTile({ href, label, icon, primary = false }: { href: string; label: string; icon: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col items-center gap-2 rounded-lg border px-2 py-4 text-center text-sm font-semibold transition-colors sm:flex-row sm:justify-center sm:gap-3 sm:py-5",
        primary
          ? "border-transparent bg-accent text-on-accent hover:bg-accent-hover"
          : "border-border bg-surface text-ink hover:border-accent/40 hover:bg-accent-tint",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-6 shrink-0">
        <path d={icon} />
      </svg>
      {label}
    </Link>
  );
}
