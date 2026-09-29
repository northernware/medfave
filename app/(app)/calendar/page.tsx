import type { Metadata } from "next";
import Link from "next/link";
import type { AppointmentStatus } from "@/lib/enums";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import {
  clinicMonthRange,
  dayKey,
  formatDayKeyHeading,
  formatMonthHeading,
  formatTime,
  formatTimeCompact,
  monthGrid,
  parseMonthKey,
  shiftMonth,
  WEEKDAY_LABELS,
  instantFromDb,
  instantToDb,
} from "@/lib/datetime";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  fullName,
  SERVICE_LABELS,
} from "@/lib/domain";
import { occupiesSlot } from "@/lib/scheduling";
import { Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

const DOT_TONE: Record<AppointmentStatus, string> = {
  PENDING: "bg-warn",
  CONFIRMED: "bg-accent",
  CHECKED_IN: "bg-accent",
  IN_CONSULTATION: "bg-accent",
  COMPLETED: "bg-ok",
  NO_SHOW: "bg-warn",
  CANCELLED: "bg-border-strong",
};

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const doctor = await requireDoctor();
  const { month, day } = await searchParams;

  const now = new Date();
  const { year, month: monthNumber } = parseMonthKey(month, now);
  const range = clinicMonthRange(year, monthNumber);

  const rows = await orm.Appointment
    .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status")
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName")
        .include("household", (h) => h.select("name")),
    )
    .where((a) => a.doctorId.eq(doctor.id))
    .where((a) => a.scheduledAt.gte(instantToDb(range.start)))
    .where((a) => a.scheduledAt.lt(instantToDb(range.end)))
    .orderBy((a) => a.scheduledAt.asc())
    .all();

  // The grid works in `Date`; the column reads as text, so convert once here.
  const appointments = rows.map((a) => ({ ...a, scheduledAt: instantFromDb(a.scheduledAt) }));

  // One pass into day buckets — the grid then reads each cell in O(1).
  const byDay = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const key = dayKey(appointment.scheduledAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const weeks = monthGrid(year, monthNumber);
  const todayKey = dayKey(now);
  const monthPrefix = `${year}-${String(monthNumber).padStart(2, "0")}`;

  // Default the panel to today when today is in view, else the first day that
  // actually has something booked.
  const requestedDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
  const selectedDay =
    requestedDay ??
    (todayKey.startsWith(monthPrefix) ? todayKey : undefined) ??
    [...byDay.keys()].sort()[0];

  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const bookedDays = [...byDay.values()].filter((list) =>
    list.some((a) => occupiesSlot(a.status)),
  ).length;

  return (
    // The month grid earns more width than the rest of the app, so on wide
    // screens this page reaches past the shell’s max-width.
    <div className="space-y-6 2xl:-mx-16">
      <PageHeader
        title="Calendar"
        subtitle={`${appointments.length} booked across ${bookedDays} ${bookedDays === 1 ? "day" : "days"} this month`}
        actions={
          <Link
            href={selectedDay ? `/appointments/new?date=${selectedDay}` : "/appointments/new"}
            className={buttonClass("primary")}
          >
            Book appointment
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card>
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <Link
              href={`/calendar?month=${shiftMonth(year, monthNumber, -1)}`}
              aria-label="Previous month"
              className={buttonClass("ghost", "px-2.5")}
            >
              ‹
            </Link>
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold">{formatMonthHeading(year, monthNumber)}</h2>
              {!todayKey.startsWith(monthPrefix) ? (
                <Link href="/calendar" className="text-xs font-medium text-accent-ink hover:underline">
                  Today
                </Link>
              ) : null}
            </div>
            <Link
              href={`/calendar?month=${shiftMonth(year, monthNumber, 1)}`}
              aria-label="Next month"
              className={buttonClass("ghost", "px-2.5")}
            >
              ›
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 py-2 text-center text-xs font-semibold text-ink-muted"
              >
                <span className="sm:hidden">{label[0]}</span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((cell) => {
              const items = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedDay;

              return (
                <Link
                  key={cell.key}
                  // A leading or trailing cell belongs to the neighbouring
                  // month, so selecting it moves the grid there too — otherwise
                  // the panel would ask for a day the month query never loaded.
                  href={`/calendar?month=${cell.inMonth ? monthPrefix : cell.key.slice(0, 7)}&day=${cell.key}`}
                  aria-current={isSelected ? "date" : undefined}
                  className={[
                    "min-h-22 border-r border-b border-border p-2 text-left transition-colors sm:min-h-34",
                    "[&:nth-child(7n)]:border-r-0 hover:bg-surface-muted",
                    cell.inMonth ? "" : "bg-surface-muted/40 text-ink-faint",
                    isSelected ? "ring-2 ring-accent ring-inset" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "tabular inline-grid size-7 place-items-center rounded-full text-sm font-medium",
                      isToday ? "bg-accent text-on-accent" : cell.inMonth ? "text-ink" : "",
                    ].join(" ")}
                  >
                    {cell.day}
                  </span>

                  {items.length > 0 ? (
                    <>
                      {/* Phones get density dots; there is no room for times. */}
                      <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
                        {items.slice(0, 6).map((a) => (
                          <span key={a.id} className={`size-1.5 rounded-full ${DOT_TONE[a.status]}`} />
                        ))}
                      </span>

                      <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                        {items.slice(0, 5).map((a) => (
                          <span
                            key={a.id}
                            className="flex items-center gap-1.5 overflow-hidden text-xs leading-snug"
                          >
                            <span className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[a.status]}`} />
                            <span className="tabular shrink-0 font-medium">
                              {formatTimeCompact(a.scheduledAt)}
                            </span>
                            <span className="truncate text-ink-muted">{a.patient.lastName}</span>
                          </span>
                        ))}
                        {items.length > 5 ? (
                          <span className="text-xs leading-snug text-ink-faint">
                            +{items.length - 5} more
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Beside the grid on large screens, stacked underneath on small ones.
            Sticky so it stays put while a long month scrolls past. */}
        <Card className="lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col">
          <div className="lg:shrink-0">
            <CardHeader
              title={selectedDay ? formatDayKeyHeading(selectedDay) : "Nothing this month"}
              subtitle={
                selected.length > 0
                  ? `${selected.length} ${selected.length === 1 ? "appointment" : "appointments"}`
                  : undefined
              }
            />
          </div>

          {selected.length === 0 ? (
            <EmptyState
              title="Nothing booked"
              description={
                selectedDay
                  ? "Pick another day in the grid, or book this one."
                  : "No appointments fall in this month."
              }
              action={
                <Link
                  href={
                    selectedDay
                      ? `/appointments/new?date=${selectedDay}`
                      : "/appointments/new"
                  }
                  className={buttonClass("primary")}
                >
                  Book appointment
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {selected.map((a) => (
                <li key={a.id} className="transition-colors hover:bg-surface-muted">
                  <Link href={`/appointments/${a.id}`} className="block px-4 py-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="tabular text-sm font-semibold">
                        {formatTime(a.scheduledAt)}
                      </span>
                      <Badge tone={APPOINTMENT_STATUS_TONE[a.status]}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium">
                      {fullName(a.patient)}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {SERVICE_LABELS[a.service]} · {a.durationMinutes} min
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {a.patient.household.name} · {a.reason}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
