"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { clinicDoctorId } from "@/lib/clinic";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { householdSchema, toFieldErrors, type FormState } from "@/lib/validation";

/**
 * Resolves the chosen primary contact, or `undefined` when the id names someone
 * who is not in this household. Checking membership here is what stops a guessed
 * id pointing at another household's patient — or another doctor's.
 */
async function resolvePrimaryContact(householdId: string, clinicId: string, contactId: string | null) {
  if (!contactId) return null;
  const member = await orm.Patient
    .select("id")
    .where((p) => p.id.eq(contactId))
    .where((p) => p.householdId.eq(householdId))
    .where((p) => p.clinicId.eq(clinicId))
    .first();
  return member?.id ?? undefined;
}

export async function createHousehold(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = householdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  // `doctorId` predates clinics and still carries authorship, so a household
  // the desk registers has to name a clinician. It names the clinic's.
  const attributedTo = staff.doctorId ?? (await clinicDoctorId(staff.clinicId));
  if (!attributedTo) return { message: "This clinic has no clinician to register under." };

  const existing = await orm.Household
    .select("id")
    .where((h) => h.clinicId.eq(staff.clinicId))
    .where((h) => h.name.eq(parsed.data.name))
    .first();
  if (existing) {
    return {
      message: "You already have a household with that name.",
      fieldErrors: { name: ["Already in use — try adding a distinguishing detail"] },
    };
  }

  const now = instantToDb(new Date());
  // A brand-new household has no members yet, so it cannot have a contact.
  const { primaryContactId: _unused, ...withoutContact } = parsed.data;

  const household = await orm.Household.select("id").create({
    ...withoutContact,
    id: newId(),
    doctorId: attributedTo,
    clinicId: staff.clinicId,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/households");
  redirect(`/households/${household.id}`);
}

export async function updateHousehold(
  householdId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = householdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const { primaryContactId, ...rest } = parsed.data;
  const primaryContact = await resolvePrimaryContact(householdId, staff.clinicId, primaryContactId);
  if (primaryContact === undefined) {
    return {
      message: "That person is not a member of this household.",
      fieldErrors: { primaryContactId: ["Pick someone in this household"] },
    };
  }

  // Scoping the update by clinicId is what stops one clinic editing another's
  // records by guessing an id.
  const updated = await orm.Household
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(staff.clinicId))
    .update({ ...rest, primaryContactId: primaryContact, updatedAt: instantToDb(new Date()) });
  if (!updated) return { message: "That household no longer exists." };

  revalidatePath("/households");
  revalidatePath(`/households/${householdId}`);
  redirect(`/households/${householdId}`);
}

export async function deleteHousehold(formData: FormData) {
  const staff = await requireStaff();
  const householdId = String(formData.get("householdId") ?? "");
  if (!householdId) return;

  await orm.Household
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(staff.clinicId))
    .delete();

  revalidatePath("/households");
  redirect("/households");
}
