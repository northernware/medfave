import { apiDoctor, apiError, readJson } from "@/lib/api";
import { dayKey } from "@/lib/datetime";
import { SERVICES } from "@/lib/domain";
import { holidaysBetween } from "@/lib/holidays-ph";
import {
  addBreakFor,
  addClosureFor,
  observesHolidays,
  removeBreakFor,
  removeClosureFor,
  saveServiceLengthsFor,
  setObserveHolidays,
} from "@/lib/schedule";
import { or } from "@prisma/orm-postgres/orm-client";
import { orm } from "@/src/prisma/db";

/**
 * The rest of a doctor's schedule, for the app: recurring breaks, closures
 * still to come, and how long each kind of visit takes. The same rules as the
 * web's schedule page (lib/schedule.ts). A doctor manages only their own.
 *
 * GET → `{ breaks, closures, observeHolidays, holidays, lengths }`
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const today = dayKey(new Date());
  const [breaks, closures, overrides, observeHolidays] = await Promise.all([
    orm.ClinicBreak
      .select("id", "weekday", "startMinute", "endMinute", "label")
      .where((b) => b.doctorId.eq(doctor.doctorId))
      .all(),
    orm.ClinicClosure
      .select("id", "startsOn", "endsOn", "startMinute", "endMinute", "reason", "repeat")
      .where((c) => c.doctorId.eq(doctor.doctorId))
      // Over, unless it repeats.
      .where((c) => or(c.endsOn.gte(today), c.repeat.neq("NONE")))
      .orderBy((c) => c.startsOn.asc())
      .all(),
    orm.ServiceDuration.select("service", "minutes").where((d) => d.doctorId.eq(doctor.doctorId)).all(),
    observesHolidays(doctor.doctorId),
  ]);
  return Response.json({
    breaks: breaks.sort((a, b) => (a.weekday ?? -1) - (b.weekday ?? -1) || a.startMinute - b.startMinute),
    closures: closures.map((c) => ({ ...c, startsOn: c.startsOn.slice(0, 10), endsOn: c.endsOn.slice(0, 10) })),
    observeHolidays,
    holidays: holidaysBetween(today, 365),
    lengths: SERVICES.map((s) => ({
      service: s.value,
      label: s.label,
      defaultMinutes: s.minutes,
      minutes: overrides.find((o) => o.service === s.value)?.minutes ?? null,
    })),
  });
}

/**
 * Body, one of:
 * - `{ kind: "break", weekday: 0-6 | null (every day), from: "HH:MM", to: "HH:MM", label }`
 * - `{ kind: "closure", startsOn: "YYYY-MM-DD", endsOn?, from?, to?, reason, repeat?: "NONE" | "WEEKLY" | "MONTHLY" | "YEARLY" }` (no times = whole days)
 * - `{ kind: "lengths", minutes: { [service]: number | null } }` (null = the built-in length)
 * - `{ kind: "holidays", observe: boolean }` (closed on Philippine holidays, or not)
 * → the same as GET.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send a JSON body.");

  // The web form's encoding, so lib/schedule.ts reads it unchanged.
  const form = new FormData();
  const put = (key: string, value: unknown) => form.set(key, value == null ? "" : String(value));
  let problem;
  if (body.kind === "break") {
    put("weekday", body.weekday);
    put("from", body.from);
    put("to", body.to);
    put("label", body.label);
    problem = await addBreakFor(doctor.doctorId, form);
  } else if (body.kind === "closure") {
    put("startsOn", body.startsOn);
    put("endsOn", body.endsOn);
    put("from", body.from);
    put("to", body.to);
    put("reason", body.reason);
    put("repeat", body.repeat ?? "NONE");
    problem = await addClosureFor(doctor.doctorId, form);
  } else if (body.kind === "holidays") {
    await setObserveHolidays(doctor.doctorId, body.observe !== false);
    return GET(request);
  } else if (body.kind === "lengths") {
    const minutes = (body.minutes ?? {}) as Record<string, unknown>;
    for (const s of SERVICES) put(`minutes-${s.value}`, minutes[s.value]);
    problem = await saveServiceLengthsFor(doctor.doctorId, form);
  } else {
    return apiError(400, 'Say what to change: kind "break", "closure", "lengths" or "holidays".');
  }
  if (problem) return apiError(422, problem.message ?? "Check the details.", problem.fieldErrors);
  return GET(request);
}

/** `?break=<id>` or `?closure=<id>` → the same as GET. */
export async function DELETE(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const p = new URL(request.url).searchParams;
  const breakId = p.get("break");
  const closureId = p.get("closure");
  const removed = breakId
    ? await removeBreakFor(doctor.doctorId, breakId)
    : closureId
      ? await removeClosureFor(doctor.doctorId, closureId)
      : false;
  if (!removed) return apiError(404, "Not found.");
  return GET(request);
}
