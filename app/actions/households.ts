"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDoctor, requireStaff } from "@/lib/auth";
import { pickDoctor } from "@/lib/clinic";
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

  // `doctorId` carries whose household it is: the signed-in doctor's, or the
  // one the desk chose.
  const attributedTo = staff.doctorId ?? (await pickDoctor(staff.clinicId, formData.get("doctorId"))).doctorId;
  if (!attributedTo) return { message: "Choose which doctor this household is for.", fieldErrors: { doctorId: ["Required"] } };

  const existing = await orm.Household
    .select("id", "archivedAt")
    .where((h) => h.clinicId.eq(staff.clinicId))
    .where((h) => h.name.eq(parsed.data.name))
    .first();
  if (existing) {
    // An archived household still holds its name, and is usually the family
    // coming back — restoring it keeps their history in one place.
    return existing.archivedAt
      ? {
          message: "An archived household already has that name. Restore it rather than starting a new one.",
          fieldErrors: { name: ["Archived household with this name"] },
        }
      : {
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
    doctorId: attributedTo!,
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

const householdBlocked = (householdId: string, why: string) =>
  redirect(`/households/${householdId}?blocked=${encodeURIComponent(why)}`);

/**
 * Sets a household aside once nobody in it is still in the working lists.
 *
 * Its members are dealt with one at a time first — archived, or moved to
 * another household. Archiving a family in one go would hide every chart in it
 * behind one click, and each of those is a decision about a person.
 */
export async function archiveHousehold(formData: FormData) {
  const doctor = await requireDoctor();
  const householdId = String(formData.get("householdId") ?? "");
  const reason = String(formData.get("archiveReason") ?? "").trim().slice(0, 300);
  if (!householdId) return;

  const household = await orm.Household
    .select("id", "archivedAt")
    .include("patients", (p) => p.where((x) => x.archivedAt.isNull()).count())
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .first();
  if (!household || household.archivedAt) return;
  if (!reason) householdBlocked(householdId, "Say why this household is being archived.");
  if (household.patients > 0) {
    householdBlocked(
      householdId,
      `${household.patients} ${household.patients === 1 ? "member is" : "members are"} still active. Archive or move each of them first.`,
    );
  }

  const now = instantToDb(new Date());
  await orm.Household.where((h) => h.id.eq(householdId)).update({
    archivedAt: now,
    archivedById: doctor.accountId,
    archiveReason: reason,
    updatedAt: now,
  });

  revalidatePath("/households");
  revalidatePath(`/households/${householdId}`);
  redirect(`/households/${householdId}`);
}

/** Brings a household back. Its members stay as they are; each is restored on their own. */
export async function restoreHousehold(formData: FormData) {
  const doctor = await requireDoctor();
  const householdId = String(formData.get("householdId") ?? "");
  if (!householdId) return;

  const household = await orm.Household
    .select("id", "archivedAt")
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .first();
  if (!household || !household.archivedAt) return;

  await orm.Household.where((h) => h.id.eq(householdId)).update({
    archivedAt: null,
    archivedById: null,
    archiveReason: null,
    updatedAt: instantToDb(new Date()),
  });

  revalidatePath("/households");
  revalidatePath(`/households/${householdId}`);
  redirect(`/households/${householdId}`);
}

/**
 * Deletes a household with nobody in it.
 *
 * Deleting a household cascades through every member's chart, so any member at
 * all — archived ones included, since their history is exactly what archiving
 * kept — is a refusal. An empty household is only ever a name and an address.
 */
export async function deleteHousehold(formData: FormData) {
  const doctor = await requireDoctor();
  const householdId = String(formData.get("householdId") ?? "");
  if (!householdId) return;

  const household = await orm.Household
    .select("id")
    .include("patients", (p) => p.count())
    .where((h) => h.id.eq(householdId))
    .where((h) => h.clinicId.eq(doctor.clinicId))
    .first();
  if (!household) return;
  if (household.patients > 0) {
    householdBlocked(
      householdId,
      `This household still has ${household.patients} ${household.patients === 1 ? "member" : "members"}, so it cannot be deleted. Move them elsewhere, or archive it instead.`,
    );
  }

  await orm.Household.where((h) => h.id.eq(householdId)).delete();

  revalidatePath("/households");
  redirect("/households");
}
