import Link from "next/link";
import { setAppointmentStatus, startConsultation } from "@/app/actions/appointments";
import { requireDoctor } from "@/lib/auth";
import { caredForIds, idsOrNone } from "@/lib/care";
import { orm } from "@/src/prisma/db";
import { followUpsDue } from "@/lib/queries";
import { sweepNoShows } from "@/lib/no-show";
import { sendDueReminders } from "@/lib/reminders";
import { RETURNED_BY_LABELS } from "@/lib/follow-up";
import {
  clinicDayRange,
  formatCalendarDate,
  formatDate,
  formatDayHeading,
  formatTime,
  instantFromDb,
  instantToDb,
  calendarDateFromDb,
} from "@/lib/datetime";
import {
  ACTIVE_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  fullName,
  QUEUE_STATUSES,
  SERVICE_LABELS,
} from "@/lib/domain";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stat, StatStrip, buttonClass } from "@/components/ui";

/** Whole minutes between two moments, floored — the number a receptionist reads. */
function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

export default async function DashboardPage() {
  const doctor = await requireDoctor();
  const now = new Date();
  const today = clinicDayRange(now);

  // Before anything is counted. A booking nobody spoke for long after its time
  // would otherwise be counted as still to come on the very screen that says
  // what is still to come.
  await sweepNoShows(doctor.id, now);
  // Tomorrow's reminders, on the same terms: no scheduler here, so this runs
  // when somebody opens the clinic's own screens.
  await sendDueReminders(doctor.clinicId, now);

  const mineIds = idsOrNone(await caredForIds(doctor));
  const [
    todaysRows,
    waitingRows,
    dueFollowUpRows,
    draftRows,
    missedRows,
    upcomingCount,
    householdCount,
    patientCount,
  ] =
    await Promise.all([
      appointmentListQuery()
        .where((a) => a.doctorId.eq(doctor.id))
        .where((a) => a.scheduledAt.gte(instantToDb(today.start)))
        .where((a) => a.scheduledAt.lt(instantToDb(today.end)))
        .orderBy((a) => a.scheduledAt.asc())
        .all(),
      // The queue: everyone who is physically here, waiting or with the doctor,
      // wherever their appointment sits in time.
      orm.Appointment
        .select(
          "id",
          "scheduledAt",
          "service",
          "reason",
          "arrivedAt",
          "consultationStartedAt",
          "source",
          "status",
        )
        .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
        .include("medicalRecord", (r) => r.select("id"))
        .where((a) => a.doctorId.eq(doctor.id))
        .where((a) => a.status.in(QUEUE_STATUSES))
        .orderBy((a) => a.scheduledAt.asc())
        .all(),
      followUpsDue(doctor.id),
      // Notes started and not finished. These are the doctor's own unfinished
      // work, so they belong on the doctor's own first screen rather than
      // waiting to be stumbled on from a patient's chart.
      orm.MedicalRecord
        .select("id", "chiefComplaint", "visitDate", "updatedAt")
        .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
        .where((r) => r.doctorId.eq(doctor.id))
        .where((r) => r.status.eq("DRAFT"))
        .where((r) => r.archivedAt.isNull())
        .orderBy((r) => r.updatedAt.desc())
        .limit(10)
        .all(),
      orm.Appointment
        .select("id", "scheduledAt", "status", "reason")
        .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
        .where((a) => a.doctorId.eq(doctor.id))
        .where((a) => a.status.in(["CANCELLED", "NO_SHOW"]))
        .where((a) => a.scheduledAt.gte(instantToDb(new Date(now.getTime() - 30 * 86_400_000))))
        .where((a) => a.scheduledAt.lt(instantToDb(today.end)))
        .orderBy((a) => a.scheduledAt.desc())
        .limit(8)
        .all(),
      orm.Appointment
        .where((a) => a.doctorId.eq(doctor.id))
        .where((a) => a.scheduledAt.gte(instantToDb(today.end)))
        .where((a) => a.status.in(ACTIVE_STATUSES))
        .aggregate((agg) => ({ n: agg.count() })),
      // The doctor's own: households with a patient they care for, and those patients.
      orm.Household
        .where((h) => h.clinicId.eq(doctor.clinicId))
        .where((h) => h.patients.some((p) => p.id.in(mineIds)))
        .where((h) => h.archivedAt.isNull())
        .aggregate((agg) => ({ n: agg.count() })),
      orm.Patient
        .where((p) => p.id.in(mineIds))
        .where((p) => p.archivedAt.isNull())
        .aggregate((agg) => ({ n: agg.count() })),
    ]);

  // Prisma 8 reads temporal columns as text; the UI works in `Date`, so each list
  // is converted once here rather than at every call site below.
  const todays = todaysRows.map(toAppointmentListItem);
  const queue = waitingRows
    .map((a) => ({
      ...a,
      scheduledAt: instantFromDb(a.scheduledAt),
      arrivedAt: a.arrivedAt ? instantFromDb(a.arrivedAt) : null,
      consultationStartedAt: a.consultationStartedAt
        ? instantFromDb(a.consultationStartedAt)
        : null,
    }))
    // Ordered by arrival, not by scheduled time — a walk-in has no meaningful
    // scheduled time, and the queue is whoever got here first.
    .sort((a, b) => (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0));
  // Waiting means still waiting. Someone with the doctor has stopped waiting,
  // and counting them as waiting is what made the number meaningless.
  const waiting = queue.filter((a) => a.status === "CHECKED_IN");
  const inConsultation = queue.filter((a) => a.status === "IN_CONSULTATION");
  const missed = missedRows.map((a) => ({ ...a, scheduledAt: instantFromDb(a.scheduledAt) }));
  const drafts = draftRows.map((r) => ({
    ...r,
    visitDate: instantFromDb(r.visitDate),
    updatedAt: instantFromDb(r.updatedAt),
  }));
  const dueFollowUps = dueFollowUpRows.map((r) => ({
    ...r,
    visitDate: instantFromDb(r.visitDate),
    followUpDate: r.followUpDate ? calendarDateFromDb(r.followUpDate) : null,
  }));
  const remaining = todays.filter(
    (a) => ACTIVE_STATUSES.includes(a.status) && a.scheduledAt >= now,
  ).length;

  const firstName = doctor.fullName.replace(/^Dr\.?\s+/i, "").split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${firstName}`}
        subtitle={formatDayHeading(now)}
        actions={
          <>
            <Link
              href="/appointments/new?source=WALK_IN"
              className={buttonClass("primary")}
            >
              Register walk-in
            </Link>
            <Link href="/appointments/new" className={buttonClass("secondary")}>
              Book appointment
            </Link>
            <Link href="/patients/new" className={buttonClass("secondary")}>
              Add patient
            </Link>
          </>
        }
      />

      {/* One object with internal rules, rather than four detached tiles. */}
      <StatStrip>
        <Stat
          label="Today"
          value={todays.length}
          hint={remaining > 0 ? `${remaining} still to come` : "Nothing left today"}
        />
        <Stat
          label="Waiting"
          value={waiting.length}
          tone={waiting.length > 0 ? "warn" : undefined}
          hint={
            inConsultation.length > 0
              ? `${inConsultation.length} with the doctor`
              : waiting.length > 0
                ? "Checked in, not seen"
                : "Nobody checked in"
          }
        />
        <Stat
          label="Follow-ups due"
          value={dueFollowUps.length}
          tone={dueFollowUps.length > 0 ? "danger" : undefined}
          hint={dueFollowUps.length > 0 ? "Asked for, not booked" : "All booked"}
        />
        <Stat label="Upcoming" value={upcomingCount.n} hint="Booked after today" />
      </StatStrip>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column: what the doctor works through, in the order they work it. */}
        <div className="space-y-6 lg:col-span-2">
          {queue.length > 0 ? (
            <section>
              <SectionTitle title="Waiting room" hint="Here now — waiting or with the doctor" />
              <Card raised className="border-warn/40 divide-y divide-border">
                {queue.map((a) => {
                  const seeing = a.status === "IN_CONSULTATION";
                  return (
                    <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      {/* Arrival, and how long it has been — the two numbers the
                          desk is asked about. The wait stops at the moment the
                          doctor took them in, rather than climbing all visit. */}
                      <span className="nums w-16 shrink-0 text-sm font-medium">
                        {formatTime(a.arrivedAt ?? a.scheduledAt)}
                        {a.arrivedAt ? (
                          <span
                            className={`tabular block font-sans text-xs font-normal ${
                              seeing ? "text-ink-faint" : "text-ink-muted"
                            }`}
                          >
                            {seeing
                              ? `waited ${minutesBetween(a.arrivedAt, a.consultationStartedAt ?? now)}m`
                              : `waiting ${minutesBetween(a.arrivedAt, now)}m`}
                          </span>
                        ) : null}
                        {a.scheduledAt < today.start ? (
                          <span className="tabular block font-sans text-xs font-normal text-warn-ink">
                            {formatDate(a.scheduledAt)}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link
                          href={`/patients/${a.patient.id}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {fullName(a.patient)}
                        </Link>
                        <span className="block truncate text-xs text-ink-muted">
                          {SERVICE_LABELS[a.service]} · {a.reason}
                          {/* Scheduled time stays visible next to the arrival
                              time; they are different facts about the visit. */}
                          {a.source !== "WALK_IN" ? ` · booked ${formatTime(a.scheduledAt)}` : ""}
                        </span>
                      </span>
                      {seeing ? (
                        <>
                          <Badge dot tone="accent">
                            In consultation
                            {a.consultationStartedAt
                              ? ` · ${minutesBetween(a.consultationStartedAt, now)}m`
                              : ""}
                          </Badge>
                          <Link
                            href={
                              a.medicalRecord
                                ? `/records/${a.medicalRecord.id}/edit`
                                : `/records/new?patientId=${a.patient.id}&appointmentId=${a.id}`
                            }
                            className={buttonClass("secondary")}
                          >
                            {a.medicalRecord ? "Open notes" : "Write notes"}
                          </Link>
                        </>
                      ) : (
                        <form action={startConsultation}>
                          <input type="hidden" name="appointmentId" value={a.id} />
                          <button className={buttonClass("primary")}>Start consultation</button>
                        </form>
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
                <Link href="/appointments" className="font-medium text-accent-ink hover:underline">
                  All appointments
                </Link>
              }
            />
            <Card>
              {todays.length === 0 ? (
                <EmptyState title="A clear day" description="No appointments booked for today." />
              ) : (
                <ul className="divide-y divide-border">
                  {todays.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                    >
                      <span className="nums w-16 shrink-0 text-sm font-medium">
                        {formatTime(a.scheduledAt)}
                      </span>
                      <Link href={`/appointments/${a.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{fullName(a.patient)}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {a.patient.household.name} · {a.reason}
                        </span>
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                          {APPOINTMENT_STATUS_LABELS[a.status]}
                        </Badge>
                        {/* One click moves the patient to the next step of the flow. */}
                        {a.status === "PENDING" || a.status === "CONFIRMED" ? (
                          <form action={setAppointmentStatus}>
                            <input type="hidden" name="appointmentId" value={a.id} />
                            <input type="hidden" name="status" value="CHECKED_IN" />
                            <button className={buttonClass("secondary")}>Check in</button>
                          </form>
                        ) : a.status === "CHECKED_IN" ? (
                          <form action={startConsultation}>
                            <input type="hidden" name="appointmentId" value={a.id} />
                            <button className={buttonClass("primary")}>Start consultation</button>
                          </form>
                        ) : a.status === "IN_CONSULTATION" && a.medicalRecord ? (
                          <Link
                            href={`/records/${a.medicalRecord.id}/edit`}
                            className={buttonClass("secondary")}
                          >
                            Open notes
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {drafts.length > 0 ? (
            <section>
              <SectionTitle title="Unfinished notes" hint="Saved, not yet signed" />
              <Card className="divide-y divide-border">
                {drafts.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.chiefComplaint || "Untitled draft"}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {fullName(r.patient)} · visit {formatDate(r.visitDate)} · last saved{" "}
                        {formatTime(r.updatedAt)}
                      </span>
                    </span>
                    <Link href={`/records/${r.id}/edit`} className={buttonClass("secondary")}>
                      Continue
                    </Link>
                  </div>
                ))}
              </Card>
            </section>
          ) : null}

          <section>
            <SectionTitle title="Follow-ups due" hint="Asked for by a visit, never booked" />
            <Card>
              {dueFollowUps.length === 0 ? (
                <EmptyState
                  title="Nothing outstanding"
                  description="Every follow-up a consultation asked for has an appointment against it."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {dueFollowUps.map((r) => {
                    const overdue = r.followUpDate! < today.start;
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <span className="tabular w-40 shrink-0 text-sm">
                          <span className={overdue ? "font-medium text-danger-ink" : "text-ink-muted"}>
                            <span className="whitespace-nowrap">{formatCalendarDate(r.followUpDate!)}</span>
                          </span>
                          {overdue ? (
                            <span className="block font-sans text-xs text-danger-ink">Overdue</span>
                          ) : null}
                          {r.followUpAppointment ? (
                            <span className="block font-sans text-xs text-warn-ink">
                              {RETURNED_BY_LABELS[
                                r.followUpAppointment.status as "CANCELLED" | "NO_SHOW"
                              ] ?? "returned"}
                            </span>
                          ) : null}
                        </span>
                        <Link href={`/records/${r.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{fullName(r.patient)}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            From {formatDate(r.visitDate)} · {r.chiefComplaint}
                          </span>
                        </Link>
                        <Link
                          href={`/appointments/new?patientId=${r.patient.id}&service=FOLLOW_UP_CHECKUP&followUpFor=${r.id}`}
                          className={buttonClass("secondary")}
                        >
                          Book follow-up
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        </div>

        {/* Rail: standing context, not today's work. */}
        <div className="space-y-6">
          <section>
            <SectionTitle title="Practice" />
            <Card className="divide-y divide-border">
              <div className="flex items-baseline justify-between px-4 py-3">
                <span className="text-sm text-ink-muted">Households</span>
                <Link href="/households" className="nums text-[15px] font-semibold hover:underline">
                  {householdCount.n}
                </Link>
              </div>
              <div className="flex items-baseline justify-between px-4 py-3">
                <span className="text-sm text-ink-muted">Patients</span>
                <Link href="/patients" className="nums text-[15px] font-semibold hover:underline">
                  {patientCount.n}
                </Link>
              </div>
            </Card>
          </section>

          {missed.length > 0 ? (
            <section>
              <SectionTitle title="Missed" hint="Last 30 days" />
              <Card className="divide-y divide-border">
                {missed.map((a) => (
                  <div key={a.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/appointments/${a.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {fullName(a.patient)}
                      </Link>
                      <Badge dot tone={APPOINTMENT_STATUS_TONE[a.status]}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs text-ink-muted">
                        <span className="tabular">{formatDate(a.scheduledAt)}</span> · {a.reason}
                      </span>
                      <Link
                        href={`/appointments/new?patientId=${a.patient.id}`}
                        className="shrink-0 text-xs font-medium text-accent-ink hover:underline"
                      >
                        Rebook
                      </Link>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
