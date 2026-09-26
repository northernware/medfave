import "server-only";
import { orm } from "@/src/prisma/db";

/**
 * The clinician a clinic-owned row is attributed to when the person doing the
 * work is not one.
 *
 * `doctorId` predates clinics and still carries authorship, so a household a
 * secretary registers has to name somebody. It names the clinic's doctor. With
 * more than one clinician this becomes a choice rather than a lookup, and this
 * is the single place that would have to ask.
 */
export async function clinicDoctorId(clinicId: string): Promise<string | null> {
  const doctor = await orm.Doctor
    .select("id")
    .where((d) => d.clinicId.eq(clinicId))
    .orderBy((d) => d.createdAt.asc())
    .first();
  return doctor?.id ?? null;
}

/** Every clinician of a clinic, for pickers that have to name one. */
export async function clinicDoctors(clinicId: string) {
  return orm.Doctor
    .select("id", "fullName", "specialty")
    .where((d) => d.clinicId.eq(clinicId))
    .orderBy((d) => d.fullName.asc())
    .all();
}
