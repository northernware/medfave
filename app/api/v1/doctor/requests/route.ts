import { apiDoctor } from "@/lib/api";
import { calendarDateFromDb, instantFromDb, toDateInputValue } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/** Requests for this doctor still waiting for an answer, oldest first. The desk sees every doctor's. */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const requests = await orm.AppointmentRequest
    .select("id", "preferredDate", "preferredTime", "service", "reason", "createdAt")
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .where((r) => r.status.eq("PENDING"))
    .orderBy((r) => r.createdAt.asc())
    .limit(100)
    .all();

  return Response.json({
    requests: requests.map((r) => ({
      id: r.id,
      preferredDate: toDateInputValue(calendarDateFromDb(r.preferredDate)),
      preferredTime: r.preferredTime,
      service: r.service,
      serviceLabel: SERVICE_LABELS[r.service],
      reason: r.reason,
      createdAt: instantFromDb(r.createdAt).toISOString(),
      patient: { id: r.patient.id, fullName: fullName(r.patient) },
    })),
  });
}
