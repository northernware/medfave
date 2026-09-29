"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClinicManager, requirePlatformAdmin, requireViewer } from "@/lib/auth";
import { createPractice, decideVerification, resubmitPractice } from "@/lib/practice";
import { formValues, type FormState } from "@/lib/validation";

/** A signed-up doctor creates their clinic. See `createPractice`. */
export async function setUpPractice(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const result = await createPractice(viewer.accountId, Object.fromEntries(formData));
  if (!result.ok) return { ...result, values: formValues(formData) };
  redirect("/manage?welcome=1");
}

/** A declined doctor sends corrected details. */
export async function sendForCheckAgain(_prev: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireClinicManager();
  if (!manager.doctorId) return { message: "Only the clinic's doctor can do this." };
  const result = await resubmitPractice(manager.doctorId, Object.fromEntries(formData));
  revalidatePath("/manage");
  return result.ok ? result : { ...result, values: formValues(formData) };
}

/** A platform admin verifies or declines a doctor. */
export async function decideDoctor(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const doctorId = String(formData.get("doctorId") ?? "");
  const result =
    formData.get("decision") === "verify"
      ? await decideVerification(admin.accountId, doctorId, { verified: true })
      : await decideVerification(admin.accountId, doctorId, { verified: false, reason: String(formData.get("reason") ?? "") });
  revalidatePath("/admin/verify");
  return result.ok ? result : { ...result, values: formValues(formData) };
}
