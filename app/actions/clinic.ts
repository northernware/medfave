"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orm } from "@/src/prisma/db";
import { requireClinicManager } from "@/lib/auth";
import { instantToDb } from "@/lib/datetime";
import { clinicDetailsSchema, toFieldErrors, type FormState } from "@/lib/validation";

/**
 * The practice's name, address and telephone.
 *
 * A manager's job — the clinician's or an administrator's. The clinic id comes
 * from the session, never the form, so this can only ever touch the clinic the
 * person works at.
 *
 * `Clinic.name` is the only copy of the name there is: the letterheads, the
 * shells, invitations, confirmations and reminders all read it, so changing it
 * here changes it everywhere at once.
 */
export async function updateClinicDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const manager = await requireClinicManager();
  const parsed = clinicDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  await orm.Clinic.where((c) => c.id.eq(manager.clinicId)).update({
    ...parsed.data,
    updatedAt: instantToDb(new Date()),
  });

  // The name sits in every shell's header, so every rendered page is stale.
  revalidatePath("/", "layout");
  redirect("/manage/clinic?saved=1");
}
