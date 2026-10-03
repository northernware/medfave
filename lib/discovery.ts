import "server-only";
import { z } from "zod";
import { orm } from "@/src/prisma/db";
import { toFieldErrors, type FormState } from "@/lib/validation";
import type { NewPatientDetails } from "@/lib/requests";

/*
 * Finding a doctor (plans/registration.md, phases 3–4). Only verified doctors
 * appear. "Find a doctor" lists clinics that opted in (`Clinic.listed`); any
 * verified clinic is also reachable by its link (`Clinic.slug`).
 */

export type FoundDoctor = {
  id: string;
  fullName: string;
  specialty: string | null;
  clinic: { id: string; name: string; address: string | null; slug: string | null };
};

export async function shape(doctors: { id: string; fullName: string; specialty: string | null; clinicId: string | null }[]) {
  const clinicIds = [...new Set(doctors.flatMap((d) => (d.clinicId ? [d.clinicId] : [])))];
  const clinics = clinicIds.length
    ? await orm.Clinic.select("id", "name", "address", "slug").where((c) => c.id.in(clinicIds)).all()
    : [];
  return doctors.flatMap((d): FoundDoctor[] => {
    const c = clinics.find((x) => x.id === d.clinicId);
    return c ? [{ id: d.id, fullName: d.fullName, specialty: d.specialty, clinic: c }] : [];
  });
}

/** Verified doctors at listed clinics, matching a name, specialty, clinic or place. */
export async function searchDoctors(q: string, specialty?: string): Promise<FoundDoctor[]> {
  const listed = await orm.Clinic.select("id").where((c) => c.listed.eq(true)).all();
  if (listed.length === 0) return [];
  const doctors = await orm.Doctor
    .select("id", "fullName", "specialty", "clinicId")
    .where((d) => d.verificationStatus.eq("VERIFIED"))
    .where((d) => d.clinicId.in(listed.map((c) => c.id)))
    .all();
  const found = await shape(doctors);
  const needle = q.trim().toLowerCase();
  return found
    .filter((d) => !specialty || (d.specialty ?? "").toLowerCase() === specialty.toLowerCase())
    .filter(
      (d) =>
        !needle ||
        [d.fullName, d.specialty ?? "", d.clinic.name, d.clinic.address ?? ""].some((t) => t.toLowerCase().includes(needle)),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .slice(0, 50);
}

/** The specialties among listed doctors, for the filter chips. */
export async function listedSpecialties(): Promise<string[]> {
  const all = await searchDoctors("");
  return [...new Set(all.flatMap((d) => (d.specialty ? [d.specialty] : [])))].sort();
}

/** One verified doctor, whether or not their clinic is listed (they may be reached by link). */
export async function findDoctor(id: string): Promise<FoundDoctor | null> {
  const d = await orm.Doctor
    .select("id", "fullName", "specialty", "clinicId")
    .where((x) => x.id.eq(id))
    .where((x) => x.verificationStatus.eq("VERIFIED"))
    .first();
  return d ? ((await shape([d]))[0] ?? null) : null;
}

/** A clinic by its link, with its verified doctors. Null when unknown or not open yet. */
export async function clinicBySlug(slug: string) {
  const clinic = await orm.Clinic.select("id", "name", "address", "contactNumber", "slug").where((c) => c.slug.eq(slug.toLowerCase())).first();
  if (!clinic) return null;
  const doctors = await orm.Doctor
    .select("id", "fullName", "specialty", "clinicId")
    .where((d) => d.clinicId.eq(clinic.id))
    .where((d) => d.verificationStatus.eq("VERIFIED"))
    .all();
  if (doctors.length === 0) return null;
  return { clinic, doctors: await shape(doctors) };
}

const newPatientSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  middleName: z.string().trim().max(80).optional().transform((v) => v || null),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  sex: z.enum(["MALE", "FEMALE"], { message: "Choose male or female" }),
  contactNumber: z.string().trim().min(7, "Enter a mobile number").max(40),
  address: z.string().trim().min(5, "Enter your address").max(300),
  email: z.string().trim().max(200).optional().transform((v) => v || null),
});

/** A new patient's details, checked. */
export function readNewPatient(input: unknown): { ok: true; details: NewPatientDetails } | ({ ok: false } & FormState) {
  const parsed = newPatientSchema.safeParse(input ?? {});
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };
  if (parsed.data.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: "Check the birthday.", fieldErrors: { dateOfBirth: ["Can't be in the future"] } };
  }
  return { ok: true, details: parsed.data };
}
