import type { Metadata } from "next";
import Link from "next/link";
import {
  addBreak,
  addClosure,
  removeBreak,
  removeClosure,
  saveBookingRules,
  saveClinicHours,
  saveOpeningHours,
  saveServiceLengths,
} from "@/app/actions/schedule";
import { requireClinicManager } from "@/lib/auth";
import { pickDoctor } from "@/lib/clinic";
import { DoctorPicker, withParam } from "@/components/doctor-picker";
import { orm } from "@/src/prisma/db";
import { DEFAULT_SCHEDULE, describeWeek, scheduleConflict } from "@/lib/availability";
import { dayKey, formatCalendarDate, calendarDateFromDb, formatDateTime, instantFromDb, instantToDb } from "@/lib/datetime";
import { ACTIVE_STATUSES, fullName, SERVICES } from "@/lib/domain";
import { loadClinicHours, loadSchedule, withinClinicHours } from "@/lib/queries";
import { labelForMinute, minuteOfDay } from "@/lib/scheduling";
import { WEEKDAY_NAMES } from "@/lib/schedule-options";
import { buttonClass, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import {
  BookingRulesForm,
  BreakForm,
  ClosureForm,
  OpeningHoursForm,
  ServiceLengthsForm,
} from "./schedule-forms";

export const metadata: Metadata = { title: "Clinic schedule" };

const SAVED: Record<string, string> = {
  hours: "Opening hours saved. The booking form offers the new week straight away.",
  clinic: "Clinic opening hours saved. Doctors' hours are kept inside them.",
  breaks: "Breaks updated.",
  closures: "Closures updated.",
  lengths: "Service lengths saved. They apply to new bookings.",
  rules: "Booking rules saved.",
};

/**
 * The clinic's week: when it opens, when it stops for lunch, when it is shut,
 * how long each kind of visit takes, and how far ahead it books.
 *
 * Every one of these was already enforced — by the slot picker, by the server
 * when a booking is posted, and on portal requests — against settings nothing
 * could write. This is the writing half.
 */
export default async function SchedulePage({ searchParams }: PageProps<"/manage/schedule">) {
  const manager = await requireClinicManager();
  const params = await searchParams;
  const { saved } = params;
  // A doctor sets their own hours; an administrator picks whose.
  const { doctorId: picked, doctors } = await pickDoctor(manager.clinicId, params.doctor);
  const doctorId = manager.doctorId ?? picked;
  const whose = doctors.find((d) => d.id === doctorId);

  // The clinic's own week, and any doctor whose hours reach outside it.
  const clinicWeek = await loadClinicHours(manager.clinicId);
  const outside: string[] = [];
  if (clinicWeek.length > 0) {
    for (const d of doctors) {
      const own = await orm.ClinicHours.select("weekday", "openMinute", "closeMinute").where((h) => h.doctorId.eq(d.id)).all();
      const kept = withinClinicHours(own, clinicWeek);
      const same = own.length === kept.length && own.every((o) => kept.some((k) => k.weekday === o.weekday && k.openMinute === o.openMinute && k.closeMinute === o.closeMinute));
      if (own.length > 0 && !same) outside.push(d.fullName);
    }
  }
  const clinicCard = (
    <Card>
      <CardHeader
        title="Clinic opening hours"
        subtitle={
          clinicWeek.length > 0
            ? "When the clinic itself is open. Every doctor's hours sit inside these."
            : "Not set: each doctor's hours stand on their own. Set them to keep every doctor inside the clinic's week."
        }
      />
      {outside.length > 0 ? (
        <p className="border-b border-border bg-warn-tint px-5 py-3 text-sm text-warn-ink">
          {outside.join(" and ")}
          {outside.length === 1 ? " has" : " have"} hours outside these. Patients are only offered the times inside
          them; update {outside.length === 1 ? "that schedule" : "those schedules"} to match.
        </p>
      ) : null}
      <div className="px-5 py-4">
        <OpeningHoursForm
          action={saveClinicHours}
          hours={clinicWeek.length > 0 ? clinicWeek : DEFAULT_SCHEDULE.hours}
          submitLabel="Save clinic hours"
        />
      </div>
    </Card>
  );

  if (!doctorId && doctors.length > 1) {
    return (
      <div className="space-y-6">
        <PageHeader title="Schedules" subtitle="The clinic's hours, and each doctor's own inside them." />
        {typeof saved === "string" && SAVED[saved] ? (
          <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
            <p className="font-medium text-ok-ink">{SAVED[saved]}</p>
          </div>
        ) : null}
        {clinicCard}
        <Card className="p-5 sm:p-6">
          <DoctorPicker
            label="Doctor"
            doctors={doctors}
            selected={null}
            hrefFor={(id) => withParam("/manage/schedule", params, "doctor", id)}
          />
        </Card>
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clinic schedule" />
        <Card>
          <EmptyState
            title="No clinician yet"
            description="Hours belong to a clinician's diary. Once the clinic has one, its week is set here."
          />
        </Card>
      </div>
    );
  }

  const now = new Date();
  const today = dayKey(now);

  const [hoursRows, breaks, closures, schedule, upcoming] = await Promise.all([
    orm.ClinicHours
      .select("weekday", "openMinute", "closeMinute")
      .where((h) => h.doctorId.eq(doctorId))
      .all(),
    orm.ClinicBreak
      .select("id", "weekday", "startMinute", "endMinute", "label")
      .where((b) => b.doctorId.eq(doctorId))
      .orderBy((b) => b.startMinute.asc())
      .all(),
    orm.ClinicClosure
      .select("id", "startsOn", "endsOn", "startMinute", "endMinute", "reason")
      .where((c) => c.doctorId.eq(doctorId))
      // Past closures no longer decide anything, so they are not shown.
      .where((c) => c.endsOn.gte(today))
      .orderBy((c) => c.startsOn.asc())
      .all(),
    loadSchedule(doctorId),
    orm.Appointment
      .select("id", "scheduledAt", "durationMinutes", "reason")
      .include("patient", (p) => p.select("firstName", "middleName", "lastName"))
      .where((a) => a.clinicId.eq(manager.clinicId))
      .where((a) => a.doctorId.eq(doctorId))
      .where((a) => a.scheduledAt.gte(instantToDb(now)))
      .where((a) => a.status.in(ACTIVE_STATUSES))
      .orderBy((a) => a.scheduledAt.asc())
      .all(),
  ]);

  // Bookings made under an earlier week that this one no longer has room for.
  // Checked with the same calendar rules booking uses, and left for a person to
  // resolve — a patient expecting a visit is told, not silently cancelled.
  const stranded = upcoming
    .map((a) => {
      const at = instantFromDb(a.scheduledAt);
      return { ...a, at, why: scheduleConflict(schedule, dayKey(at), minuteOfDay(at), a.durationMinutes) };
    })
    .filter((a) => a.why !== null);

  const configured = hoursRows.length > 0;
  const overrides = new Map(
    Object.entries(schedule.serviceDurations).map(([service, minutes]) => [service, minutes as number]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctors.length > 1 && whose ? `${whose.fullName}'s schedule` : "Clinic schedule"}
        subtitle={`${describeWeek(schedule)}${schedule.breaks.length ? `, with ${schedule.breaks.length} break${schedule.breaks.length === 1 ? "" : "s"}` : ""}.`}
        actions={
          <Link href="/manage" className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />

      {manager.doctorId ? null : (
        <DoctorPicker
          label="Doctor"
          doctors={doctors}
          selected={doctorId}
          hrefFor={(id) => withParam("/manage/schedule", { doctor: id }, "doctor", id)}
        />
      )}

      {typeof saved === "string" && SAVED[saved] ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
          <p className="font-medium text-ok-ink">{SAVED[saved]}</p>
        </div>
      ) : null}

      {stranded.length > 0 ? (
        <Card className="border-warn/40">
          <CardHeader
            title={`${stranded.length} booking${stranded.length === 1 ? " falls" : "s fall"} outside the schedule`}
            subtitle="Made before the hours changed. Nothing has been moved or cancelled — contact these patients and rebook them."
          />
          <ul className="divide-y divide-border">
            {stranded.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-2.5 text-sm">
                <span className="tabular w-48 shrink-0">{formatDateTime(a.at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {fullName(a.patient)} <span className="text-ink-muted">· {a.why}</span>
                </span>
                <Link
                  href={`/desk/appointments/${a.id}`}
                  className="text-xs font-medium text-accent-ink hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {clinicCard}

      <Card>
        <CardHeader
          title={doctors.length > 1 && whose ? `${whose.fullName}'s hours` : "Opening hours"}
          subtitle={
            configured
              ? "The clinic's week. Bookings are only offered inside these hours."
              : "Not set yet, so the clinic runs on the standard week shown here. Saving makes it the clinic's own."
          }
        />
        <div className="px-5 py-4">
          <OpeningHoursForm
            action={saveOpeningHours.bind(null, doctorId)}
            hours={configured ? hoursRows : withinClinicHours(DEFAULT_SCHEDULE.hours, clinicWeek)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Breaks" subtitle="Every week, at the same time. No bookings are offered during them." />
        {breaks.length > 0 ? (
          <ul className="divide-y divide-border border-b border-border">
            {breaks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {b.weekday === null ? "every open day" : `${WEEKDAY_NAMES[b.weekday]}s`},{" "}
                    {labelForMinute(b.startMinute)} to {labelForMinute(b.endMinute)}
                  </span>
                </span>
                <form action={removeBreak.bind(null, doctorId)}>
                  <input type="hidden" name="breakId" value={b.id} />
                  <button className="text-xs font-medium text-ink-muted hover:text-danger-ink">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="px-5 py-4">
          <BreakForm action={addBreak.bind(null, doctorId)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Closures"
          subtitle="Holidays, leave, a morning off. Nobody can book into them, and the reason is shown to anybody who tries."
        />
        {closures.length > 0 ? (
          <ul className="divide-y divide-border border-b border-border">
            {closures.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.reason}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {formatCalendarDate(calendarDateFromDb(c.startsOn))}
                    {c.endsOn !== c.startsOn ? ` to ${formatCalendarDate(calendarDateFromDb(c.endsOn))}` : ""}
                    {c.startMinute !== null && c.endMinute !== null
                      ? `, ${labelForMinute(c.startMinute)} to ${labelForMinute(c.endMinute)}`
                      : ", all day"}
                  </span>
                </span>
                <form action={removeClosure.bind(null, doctorId)}>
                  <input type="hidden" name="closureId" value={c.id} />
                  <button className="text-xs font-medium text-ink-muted hover:text-danger-ink">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="px-5 py-4">
          <ClosureForm action={addClosure.bind(null, doctorId)} today={today} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Service lengths"
          subtitle="How long each kind of visit is booked for. The slot grid resizes to match."
        />
        <div className="px-5 py-4">
          <ServiceLengthsForm
            action={saveServiceLengths.bind(null, doctorId)}
            services={SERVICES.map((s) => ({
              value: s.value,
              label: s.label,
              builtIn: s.minutes,
              override: overrides.get(s.value) ?? null,
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Booking rules" subtitle="How the day is divided and how far ahead the clinic books." />
        <div className="px-5 py-4">
          <BookingRulesForm
            action={saveBookingRules.bind(null, doctorId)}
            rules={{
              slotStepMinutes: schedule.slotStepMinutes,
              minLeadMinutes: schedule.minLeadMinutes,
              maxLeadDays: schedule.maxLeadDays,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
