import { apiDoctor, apiError } from "@/lib/api";
import { APPOINTMENT_COLUMNS, shapeAppointment } from "@/lib/api-shapes";
import { calendarDateFromDb, instantToDb, toDateInputValue } from "@/lib/datetime";
import { fullName, SEX_LABELS } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * One of the clinic's patients: who they are, how to reach them, their
 * household, and their visits either side of now. Clinical notes stay on the
 * web, where they are written.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/doctor/patients/[id]">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const now = instantToDb(new Date());

  const patient = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "patientNumber", "dateOfBirth", "sex", "contactNumber", "email", "archivedAt")
    .include("household", (h) => h.select("id", "name"))
    .where((p) => p.id.eq(id))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .first();
  if (!patient) return apiError(404, "No patient with that id.");

  const [upcoming, past] = await Promise.all([
    orm.Appointment
      .select(...APPOINTMENT_COLUMNS)
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.patientId.eq(id))
      .where((a) => a.clinicId.eq(doctor.clinicId))
      .where((a) => a.scheduledAt.gte(now))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(10)
      .all(),
    orm.Appointment
      .select(...APPOINTMENT_COLUMNS)
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((a) => a.patientId.eq(id))
      .where((a) => a.clinicId.eq(doctor.clinicId))
      .where((a) => a.scheduledAt.lt(now))
      .orderBy((a) => a.scheduledAt.desc())
      .limit(10)
      .all(),
  ]);

  return Response.json({
    patient: {
      id: patient.id,
      fullName: fullName(patient),
      patientNumber: patient.patientNumber,
      dateOfBirth: patient.dateOfBirth ? toDateInputValue(calendarDateFromDb(patient.dateOfBirth)) : null,
      sex: patient.sex,
      sexLabel: patient.sex ? SEX_LABELS[patient.sex] : null,
      contactNumber: patient.contactNumber,
      email: patient.email,
      household: { id: patient.household.id, name: patient.household.name },
      archived: patient.archivedAt !== null,
    },
    upcoming: upcoming.map(shapeAppointment),
    past: past.map(shapeAppointment),
  });
}
