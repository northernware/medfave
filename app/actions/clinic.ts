"use server";

import { revalidatePath } from "next/cache";
import { ensureSlug } from "@/lib/clinic-link";
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

/**
 * Whether the clinic's doctors share charts: every doctor there may read every
 * patient's chart and visit notes (notes stay the author's to change). Off by
 * default. Every chart opened is logged either way (lib/care.ts).
 */
/** Whether the clinic appears in the app's "Find a doctor". Its link works either way. */
export async function setListed(formData: FormData) {
  const manager = await requireClinicManager();
  await orm.Clinic.where((c) => c.id.eq(manager.clinicId)).update({
    listed: formData.get("listed") === "on",
    updatedAt: instantToDb(new Date()),
  });
  await ensureSlug(manager.clinicId);
  revalidatePath("/manage/clinic");
  redirect("/manage/clinic?saved=listing");
}

export async function setSharedCharts(formData: FormData) {
  const manager = await requireClinicManager();
  await orm.Clinic.where((c) => c.id.eq(manager.clinicId)).update({
    sharedCharts: formData.get("sharedCharts") === "on",
    updatedAt: instantToDb(new Date()),
  });
  revalidatePath("/manage/clinic");
  redirect("/manage/clinic?saved=sharing");
}
