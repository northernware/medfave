import { apiDoctor } from "@/lib/api";
import { fullName } from "@/lib/domain";
import { orm } from "@/src/prisma/db";

/**
 * The clinic's patients, for looking one up or picking one to book.
 *
 * `?q=` matches any part of the name or the patient number. Archived charts are
 * left out, as in the web's pickers. Read whole and filtered here, like
 * `patientOptions`: one clinic's list is small.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();

  const patients = await orm.Patient
    .select("id", "firstName", "middleName", "lastName", "patientNumber")
    .include("household", (h) => h.select("name"))
    .where((p) => p.clinicId.eq(doctor.clinicId))
    .where((p) => p.archivedAt.isNull())
    .all();

  const matches = patients
    .map((p) => ({
      id: p.id,
      fullName: fullName(p),
      patientNumber: p.patientNumber,
      household: p.household.name,
    }))
    .filter((p) => !q || p.fullName.toLowerCase().includes(q) || (p.patientNumber ?? "").toLowerCase().includes(q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .slice(0, 50);

  return Response.json({ patients: matches });
}
