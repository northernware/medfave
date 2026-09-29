import "server-only";
import { orm } from "@/src/prisma/db";

/** A doctor a booking or request can name: verified, at this clinic. */
export type ClinicDoctor = { id: string; fullName: string; specialty: string | null };

/**
 * The clinic's doctors who can be booked: verified ones, by name. Every doctor
 * at a clinic is equal; there is no "the clinic's doctor" (plans/
 * group-practice-findings.md).
 */
export async function clinicDoctors(clinicId: string): Promise<ClinicDoctor[]> {
  const doctors = await orm.Doctor
    .select("id", "fullName", "specialty")
    .where((d) => d.clinicId.eq(clinicId))
    .where((d) => d.verificationStatus.eq("VERIFIED"))
    .all();
  return doctors.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** The doctor this patient saw or booked most recently at the clinic, if any. */
export async function lastDoctorFor(clinicId: string, patientId: string): Promise<string | null> {
  const last = await orm.Appointment
    .select("doctorId")
    .where((a) => a.clinicId.eq(clinicId))
    .where((a) => a.patientId.eq(patientId))
    .orderBy((a) => a.scheduledAt.desc())
    .first();
  return last?.doctorId ?? null;
}

/**
 * Which doctor a booking, request or registration is for.
 *
 * The one asked for, if it is a bookable doctor of this clinic; otherwise the
 * fallback (the patient's last doctor, say) if that is; otherwise the only
 * doctor, when there is just one. Null means somebody has to choose.
 */
export async function pickDoctor(
  clinicId: string,
  requested: unknown,
  fallback?: string | null,
): Promise<{ doctorId: string | null; doctors: ClinicDoctor[] }> {
  const doctors = await clinicDoctors(clinicId);
  const valid = (id: unknown) => typeof id === "string" && doctors.some((d) => d.id === id);
  const doctorId = valid(requested)
    ? (requested as string)
    : valid(fallback)
      ? (fallback as string)
      : doctors.length === 1
        ? doctors[0].id
        : null;
  return { doctorId, doctors };
}

/**
 * The practice as it appears on paper: name, address, telephone.
 *
 * Read only where something is printed, rather than carried on every request,
 * because nothing else needs the address.
 */
export async function clinicLetterhead(clinicId: string) {
  const clinic = await orm.Clinic
    .select("name", "address", "contactNumber")
    .where((c) => c.id.eq(clinicId))
    .first();
  return {
    name: clinic?.name ?? "",
    address: clinic?.address ?? null,
    contactNumber: clinic?.contactNumber ?? null,
  };
}

export type ClinicLetterhead = Awaited<ReturnType<typeof clinicLetterhead>>;
