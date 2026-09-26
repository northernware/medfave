import type { Metadata } from "next";
import Link from "next/link";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { sweepNoShows } from "@/lib/no-show";
import { sendDueReminders } from "@/lib/reminders";
import { clinicDoctors } from "@/lib/clinic";
import {
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
import { Badge, buttonClass, Card, EmptyState, PageHeader, SectionTitle, Stat, StatStrip } from "@/components/ui";

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
      <PageHeader
        title="Front desk"
        subtitle={formatDayHeading(now)}
        actions={
          <>
            <Link href="/desk/appointments/new?source=WALK_IN" className={buttonClass("primary")}>
              Register walk-in
            </Link>
            <Link href="/desk/appointments/new" className={buttonClass("secondary")}>
              Book appointment
            </Link>
            <Link href="/desk/patients/new" className={buttonClass("secondary")}>
              Add patient
            </Link>
          </>
        }
      />

      <StatStrip>
        <Stat label="Today" value={todays.length} hint={remaining > 0 ? `${remaining} still to come` : "Nothing left today"} />
        <Stat
          label="Waiting"
          value={waiting.length}
          tone={waiting.length > 0 ? "warn" : undefined}
          hint={seeing.length > 0 ? `${seeing.length} with the doctor` : "Nobody checked in"}
        />
        <Stat
          label="Requests"
          value={pendingRequests.n}
          tone={pendingRequests.n > 0 ? "warn" : undefined}
          hint={pendingRequests.n > 0 ? "Waiting on an answer" : "None outstanding"}
        />
      </StatStrip>

      {queue.length > 0 ? (
        <section>
          <SectionTitle title="Waiting room" hint="Here now — waiting or with the doctor" />
          <Card raised className="divide-y divide-border border-warn/40">
            {queue.map((a) => {
              const withDoctor = a.status === "IN_CONSULTATION";
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="nums w-16 shrink-0 text-[13px] font-medium">
                    {formatTime(a.arrivedAt ?? a.scheduledAt)}
                    {a.arrivedAt ? (
                      <span className="tabular block font-sans text-[11px] font-normal text-ink-muted">
                        {withDoctor
                          ? `waited ${minutesBetween(a.arrivedAt, a.consultationStartedAt ?? now)}m`
                          : `waiting ${minutesBetween(a.arrivedAt, now)}m`}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/desk/appointments/${a.id}`}
                      className="block truncate text-[13px] font-medium hover:underline"
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
                  <span className="nums w-16 shrink-0 text-[13px] font-medium">
                    {formatTime(a.scheduledAt)}
                  </span>
                  <Link href={`/desk/appointments/${a.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
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
