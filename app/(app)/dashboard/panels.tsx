import Link from "next/link";
import { setAppointmentStatus, startConsultation } from "@/app/actions/appointments";
import { CLINIC_TIME_ZONE, dayKey, formatCalendarDate, formatTime } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONE, fullName, SERVICE_LABELS } from "@/lib/domain";
import type { AppointmentListItem } from "@/components/appointment-list";
import { addDays, minuteOfDay, weekdayOf } from "@/lib/scheduling";
import { Badge, buttonClass, EmptyState } from "@/components/ui";

/*
 * The doctor's Today, laid out like the reference design: stat tiles, the
 * patients coming up with the selected one's last visit beside them, and the
 * day's schedule as a timeline on the right.
 */

export const PANEL = "rounded-xl border border-border bg-surface";

/** "Oct 2", in clinic time. */
const shortDay = (at: Date) =>
  at.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: CLINIC_TIME_ZONE });

const initials = (p: { firstName: string; lastName: string }) =>
  `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

export function StatCard({
  value,
  label,
  hint,
  tone,
  href,
}: {
  value: number;
  label: string;
  hint: string;
  tone?: "warn" | "danger";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="nums font-display text-[34px] leading-none font-semibold tracking-[-0.02em]">{value}</p>
        {tone && value > 0 ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone === "danger" ? "bg-danger-tint text-danger-ink" : "bg-warn-tint text-warn-ink"}`}
          >
            {tone === "danger" ? "Due" : "Now"}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-sm font-medium">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </>
  );
  const cls = `${PANEL} block p-5 transition-colors`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Who is coming, soonest first. The selected one (dark) is the one whose last visit shows beside. */
export function PatientsList({
  upcoming,
  selectedId,
  todayKey,
  day,
}: {
  upcoming: AppointmentListItem[];
  selectedId: string | null;
  todayKey: string;
  /** The schedule panel's day, kept when another patient is picked. */
  day?: string;
}) {
  return (
    <section className={`${PANEL} flex flex-col p-5`}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Patients list</h2>
        <span className="text-xs text-ink-faint">By upcoming</span>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState title="Nobody booked" description="Upcoming visits appear here." />
      ) : (
        <ul className="space-y-2">
          {upcoming.map((a) => {
            const on = a.id === selectedId;
            const sameDay = dayKey(a.scheduledAt) === todayKey;
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard?visit=${a.id}${day ? `&day=${day}` : ""}`}
                  scroll={false}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    on ? "bg-accent text-on-accent" : "bg-surface-muted/70 hover:bg-surface-muted",
                  ].join(" ")}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-xs font-semibold ${on ? "bg-on-accent/15 text-on-accent" : "bg-accent-soft text-accent-ink"}`}
                  >
                    {initials(a.patient)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{fullName(a.patient)}</span>
                    <span className={`block truncate text-xs ${on ? "text-on-accent/75" : "text-ink-muted"}`}>
                      {SERVICE_LABELS[a.service]}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm leading-tight font-medium">
                    {sameDay ? "Today" : shortDay(a.scheduledAt)}
                    <span className={`block text-xs font-normal ${on ? "text-on-accent/75" : "text-ink-faint"}`}>
                      {formatTime(a.scheduledAt)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/appointments" className="mt-4 text-sm font-medium text-accent-ink hover:underline">
        All appointments
      </Link>
    </section>
  );
}

export type LastVisit = {
  patient: { id: string; firstName: string; middleName: string | null; lastName: string; sexLabel: string; age: string; patientNumber: string | null };
  record: {
    id: string;
    visitDate: Date;
    chiefComplaint: string;
    assessment: string | null;
    treatmentPlan: string | null;
    notes: string | null;
    followUpDate: Date | null;
    prescriptions: { drugName: string; dosage: string; frequency: string }[];
  } | null;
  allergies: string[];
};

/** The selected patient's most recent visit with this doctor. */
export function LastVisitDetails({ visit, doctorName }: { visit: LastVisit | null; doctorName: string }) {
  if (!visit) {
    return (
      <section className={`${PANEL} p-5`}>
        <h2 className="font-display text-lg font-semibold">Last visit details</h2>
        <EmptyState title="Choose a patient" description="Their most recent visit with you shows here." />
      </section>
    );
  }
  const { patient, record } = visit;
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd className="text-sm leading-6 font-medium whitespace-pre-line">{value}</dd>
      </div>
    ) : null;
  return (
    <section className={`${PANEL} p-5`}>
      <h2 className="font-display text-lg font-semibold">Last visit details</h2>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/patients/${patient.id}`} className="font-display text-lg font-semibold hover:underline">
            {fullName(patient)}
          </Link>
          <p className="text-sm text-ink-muted">
            {patient.sexLabel}, {patient.age}
          </p>
        </div>
        {patient.patientNumber ? <span className="tabular text-sm text-ink-faint">{patient.patientNumber}</span> : null}
      </div>
      {visit.allergies.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visit.allergies.map((a) => (
            <span key={a} className="rounded-full bg-danger-tint px-2.5 py-1 text-xs font-semibold text-danger-ink">
              Allergy: {a}
            </span>
          ))}
        </div>
      ) : null}
      {record ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {record.chiefComplaint
              .split(/,|;| and /)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
              .map((c) => (
                <span key={c} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium">
                  {c}
                </span>
              ))}
          </div>
          <dl className="mt-5 space-y-4">
            {row("Last checked", `${doctorName} on ${formatCalendarDate(record.visitDate)}`)}
            {row("Assessment", record.assessment)}
            {row("Plan", record.treatmentPlan)}
            {row(
              "Prescription",
              record.prescriptions.length > 0
                ? record.prescriptions.map((p) => `${p.drugName} ${p.dosage} — ${p.frequency}`).join("\n")
                : null,
            )}
            {row("Follow-up", record.followUpDate ? formatCalendarDate(record.followUpDate) : null)}
            {row("Notes", record.notes)}
          </dl>
          <Link href={`/records/${record.id}`} className={`${buttonClass("secondary")} mt-5`}>
            Open the note
          </Link>
        </>
      ) : (
        <p className="mt-5 text-sm text-ink-muted">No visit notes with you yet.</p>
      )}
    </section>
  );
}

const HOUR = 72; // px per hour on the timeline

/** The week as a strip, then today as a timeline with a line at the current time. */
export function ScheduleRail({
  items: todays,
  dayKey: selected,
  todayKey,
  now,
  keep,
}: {
  /** The chosen day's visits. */
  items: AppointmentListItem[];
  /** The chosen day (YYYY-MM-DD); today unless picked from the strip. */
  dayKey: string;
  todayKey: string;
  now: Date;
  /** Other dashboard state to keep in links (the selected patient). */
  keep: string;
}) {
  const href = (key: string) => `/dashboard?${[keep, key === todayKey ? "" : `day=${key}`].filter(Boolean).join("&")}`;
  const monday = addDays(selected, -((weekdayOf(selected) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [y, m] = selected.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayLabel = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", timeZone: "UTC" });

  const starts = todays.map((a) => minuteOfDay(a.scheduledAt));
  const ends = todays.map((a) => minuteOfDay(a.scheduledAt) + a.durationMinutes);
  const firstHour = Math.min(8, ...starts.map((s) => Math.floor(s / 60)));
  const lastHour = Math.max(18, ...ends.map((e) => Math.ceil(e / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const nowMinute = minuteOfDay(now);
  const top = (minute: number) => ((minute - firstHour * 60) / 60) * HOUR;
  const label = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

  return (
    <section className={`${PANEL} flex flex-col overflow-hidden`}>
      <div className="border-b border-border p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Link href={href(addDays(selected, -7))} scroll={false} aria-label="Previous week" className="grid size-8 place-items-center rounded-full hover:bg-surface-muted">
              ‹
            </Link>
            <Link href={href(addDays(selected, 7))} scroll={false} aria-label="Next week" className="grid size-8 place-items-center rounded-full hover:bg-surface-muted">
              ›
            </Link>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center">
          {week.map((key) => {
            const on = key === selected;
            const today = key === todayKey;
            return (
              <Link key={key} href={href(key)} scroll={false} aria-current={on ? "date" : undefined} className="group space-y-2">
                <span className="block text-xs text-ink-faint">{weekdayLabel(key)}</span>
                <span
                  className={`mx-auto grid size-9 place-items-center rounded-full text-sm font-semibold transition-colors ${on ? "bg-accent text-on-accent" : today ? "text-accent-ink ring-1 ring-accent/50" : "group-hover:bg-surface-muted"}`}
                >
                  {Number(key.slice(8))}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="p-5 pb-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-semibold">
            {selected === todayKey
              ? "Today"
              : new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </h3>
          <span className="flex items-center gap-3 text-xs text-ink-faint">
            {todays.length} visit{todays.length === 1 ? "" : "s"}
            <Link href={`/calendar?day=${selected}`} className="font-medium text-accent-ink hover:underline">
              Open in calendar
            </Link>
          </span>
        </div>
        <div className="relative" style={{ height: (hours.length - 1) * HOUR + 8 }}>
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 flex items-start gap-3" style={{ top: top(h * 60) - 7 }}>
              <span className="tabular w-14 shrink-0 text-right text-[11px] text-ink-faint">{label(h)}</span>
              <span className="mt-[7px] h-px flex-1 bg-border" />
            </div>
          ))}
          {todays.map((a) => {
            const start = minuteOfDay(a.scheduledAt);
            const height = Math.max(54, (a.durationMinutes / 60) * HOUR - 4);
            const done = a.status === "COMPLETED" || a.status === "CANCELLED" || a.status === "NO_SHOW";
            return (
              <div
                key={a.id}
                className={`absolute right-0 left-[68px] overflow-hidden rounded-xl border px-3 py-2 ${done ? "border-border bg-surface-muted/50 opacity-70" : "border-border-strong bg-surface-muted"}`}
                style={{ top: top(start) + 2, height }}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/appointments/${a.id}`} className="min-w-0">
                    <span className="block truncate text-sm font-semibold hover:underline">{fullName(a.patient)}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {formatTime(a.scheduledAt)} · {SERVICE_LABELS[a.service]}
                    </span>
                  </Link>
                  {a.status === "PENDING" || a.status === "CONFIRMED" ? (
                    <form action={setAppointmentStatus}>
                      <input type="hidden" name="appointmentId" value={a.id} />
                      <input type="hidden" name="status" value="CHECKED_IN" />
                      <button className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold hover:bg-accent-soft">Check in</button>
                    </form>
                  ) : a.status === "CHECKED_IN" ? (
                    <form action={startConsultation}>
                      <input type="hidden" name="appointmentId" value={a.id} />
                      <button className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">Start</button>
                    </form>
                  ) : (
                    <Badge tone={APPOINTMENT_STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                  )}
                </div>
              </div>
            );
          })}
          {selected === todayKey && nowMinute >= firstHour * 60 && nowMinute <= lastHour * 60 ? (
            <div className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: top(nowMinute) - 10 }}>
              <span className="tabular w-14 shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-center text-[11px] font-semibold text-canvas">
                {formatTime(now).replace(/\s?[AP]M$/i, "")}
              </span>
              <span className="ml-1 h-px flex-1 bg-ink" />
            </div>
          ) : null}
        </div>
        {todays.length === 0 ? <p className="mt-4 text-center text-sm text-ink-muted">Nothing booked.</p> : null}
      </div>
    </section>
  );
}
