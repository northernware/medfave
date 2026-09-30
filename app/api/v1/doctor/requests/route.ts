import { apiDoctor } from "@/lib/api";
import { calendarDateFromDb, instantFromDb, toDateInputValue } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { findPossibleDuplicates } from "@/lib/queries";
import { orm } from "@/src/prisma/db";

/** Requests for this doctor still waiting for an answer, oldest first. The desk sees every doctor's. */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;

  const requests = await orm.AppointmentRequest
    .select(
      "id", "preferredDate", "preferredTime", "service", "reason", "createdAt",
      "newFirstName", "newMiddleName", "newLastName", "newDateOfBirth", "newContactNumber", "newEmail",
    )
    .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
    .where((r) => r.clinicId.eq(doctor.clinicId))
    .where((r) => r.doctorId.eq(doctor.doctorId))
    .where((r) => r.status.eq("PENDING"))
    .orderBy((r) => r.createdAt.asc())
    .limit(100)
    .all();

  // A new patient: records the clinic may already have for them. The doctor
  // decides; nothing is merged automatically.
  const lookalikes = new Map(
    await Promise.all(
      requests.filter((r) => !r.patient).map(async (r) => [
        r.id,
        await findPossibleDuplicates(doctor.clinicId, {
          firstName: r.newFirstName ?? "",
          lastName: r.newLastName ?? "",
          dateOfBirth: r.newDateOfBirth ?? "",
          contactNumber: r.newContactNumber,
          email: r.newEmail,
        }),
      ] as const),
    ),
  );

  return Response.json({
    requests: requests.map((r) => ({
      id: r.id,
      preferredDate: toDateInputValue(calendarDateFromDb(r.preferredDate)),
      preferredTime: r.preferredTime,
      service: r.service,
      serviceLabel: SERVICE_LABELS[r.service],
      reason: r.reason,
      createdAt: instantFromDb(r.createdAt).toISOString(),
      patient: r.patient
        ? { id: r.patient.id, fullName: fullName(r.patient) }
        : { id: null, fullName: fullName({ firstName: r.newFirstName ?? "", middleName: r.newMiddleName, lastName: r.newLastName ?? "" }) },
      /** No record at this clinic yet: accepting links (`record: <patientId>`) or creates (`record: "new"`) one. */
      newPatient: r.patient
        ? null
        : {
            dateOfBirth: r.newDateOfBirth ? toDateInputValue(calendarDateFromDb(r.newDateOfBirth)) : null,
            contactNumber: r.newContactNumber,
            email: r.newEmail,
            lookalikes: lookalikes.get(r.id) ?? [],
          },
    })),
  });
}
