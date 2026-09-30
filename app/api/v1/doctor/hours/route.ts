import { apiDoctor, apiError, readJson } from "@/lib/api";
import { writeClinicWeek, writeDoctorWeek } from "@/lib/hours";
import { DEFAULT_SCHEDULE } from "@/lib/availability";
import { loadClinicHours, withinClinicHours } from "@/lib/queries";
import { orm } from "@/src/prisma/db";

/**
 * A doctor's own week and the clinic's, for the app. The same rules as the
 * web's schedule page (lib/hours.ts): a doctor's hours sit inside the clinic's.
 * Any doctor of the clinic manages the clinic's hours, as on the web.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const [mine, clinic] = await Promise.all([
    orm.ClinicHours.select("weekday", "openMinute", "closeMinute").where((h) => h.doctorId.eq(doctor.doctorId)).all(),
    loadClinicHours(doctor.clinicId),
  ]);
  // Never set: the doctor runs on the standard week, kept inside the clinic's.
  const configured = mine.length > 0;
  return Response.json({
    mine: configured ? mine : withinClinicHours(DEFAULT_SCHEDULE.hours, clinic),
    mineConfigured: configured,
    clinic,
  });
}

/** Body: `{ which: "mine" | "clinic", days: [{ weekday: 0-6, from: "HH:MM", to: "HH:MM" }] }` — the open days only. */
export async function PUT(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body || !Array.isArray(body.days)) return apiError(400, "Send { which, days: [...] }.");

  // The web form's encoding, so lib/hours.ts reads it unchanged.
  const form = new FormData();
  for (const d of body.days as Record<string, unknown>[]) {
    const w = Number(d.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6) continue;
    form.set(`open-${w}`, "on");
    form.set(`from-${w}`, String(d.from ?? ""));
    form.set(`to-${w}`, String(d.to ?? ""));
  }
  const problem =
    body.which === "clinic"
      ? await writeClinicWeek(doctor.clinicId, form)
      : await writeDoctorWeek(doctor.clinicId, doctor.doctorId, form);
  if (problem) return apiError(422, problem.message ?? "Check the hours.", problem.fieldErrors);
  return GET(request);
}
