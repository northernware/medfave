import { apiPatient } from "@/lib/api";
import { describeWeek, earliestBookableDay, latestBookableDay } from "@/lib/availability";
import { clinicDoctorId, clinicLetterhead } from "@/lib/clinic";
import { dayKey } from "@/lib/datetime";
import { SERVICES } from "@/lib/domain";
import { loadSchedule } from "@/lib/queries";

/**
 * The patient's clinic, and what the request form needs to know about it: the
 * services, the week's hours, closures ahead, and the range of dates it takes
 * requests for. The server still checks every request against the same rules;
 * this is so the app can say so before the patient taps Send.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;

  const [letterhead, doctorId] = await Promise.all([clinicLetterhead(me.clinicId), clinicDoctorId(me.clinicId)]);
  const schedule = doctorId ? await loadSchedule(doctorId) : null;
  const today = dayKey(new Date());

  return Response.json({
    clinic: letterhead,
    takingRequests: schedule !== null,
    services: SERVICES.map((s) => ({ value: s.value, label: s.label, description: s.description, minutes: s.minutes })),
    schedule: schedule
      ? {
          summary: describeWeek(schedule),
          hours: schedule.hours,
          closures: schedule.closures.filter((c) => c.endsOn >= today),
          earliestDay: earliestBookableDay(schedule),
          latestDay: latestBookableDay(schedule),
        }
      : null,
  });
}
