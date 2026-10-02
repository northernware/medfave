"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_CLINIC_COOKIE, PORTAL_PERSON_COOKIE, requirePatientAccount, requireViewer } from "@/lib/auth";
import { linkPatientActivation, previewActivation, type ActivationPreview } from "@/lib/sign-in";
import { grantCare, removeCare, stopCaring, stopCaringFor } from "@/lib/caregivers";
import { addFamilyMember, removeFamilyMember } from "@/lib/family";
import { choosePhysician } from "@/lib/emergency";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/validation";

const remember = async (clinicId: string) =>
  (await cookies()).set(PORTAL_CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

/** Switches which of the patient's clinics the portal shows. Only one they are linked to. */
export async function choosePortalClinic(formData: FormData) {
  const me = await requirePatientAccount();
  const clinicId = String(formData.get("clinicId") ?? "");
  if (me.charts.some((c) => c.clinicId === clinicId)) {
    await remember(clinicId);
    (await cookies()).delete(PORTAL_PERSON_COOKIE);
  }
  redirect("/portal");
}

/** Switches whose records the portal shows: their own, or somebody they look after. Only charts this login may act on. */
export async function choosePortalPerson(formData: FormData) {
  const me = await requirePatientAccount();
  const chart = me.charts.find((c) => c.id === String(formData.get("patientId") ?? ""));
  if (chart) {
    await remember(chart.clinicId);
    (await cookies()).set(PORTAL_PERSON_COOKIE, chart.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/portal");
}

/** "Add a clinic", step one: whose chart the code opens, for the person to confirm before anything is linked. */
export async function previewAddClinic(
  _prev: FormState & { preview?: ActivationPreview },
  formData: FormData,
): Promise<FormState & { preview?: ActivationPreview }> {
  const viewer = await requireViewer();
  const result = await previewActivation(formData.get("code"), `code:account:${viewer.accountId}`, viewer.email);
  return result.ok ? { preview: result.preview } : result;
}

/** "Add a clinic", step two: the confirmed chart joins this login. */
export async function addClinic(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const result = await linkPatientActivation(
    viewer.accountId,
    formData.get("code"),
    String(formData.get("confirmedPatientId") ?? ""),
  );
  if (!result.ok) return result;
  await remember(result.clinicId);
  // Open on the chart just linked — their own, or the person they now look after.
  (await cookies()).set(PORTAL_PERSON_COOKIE, result.patientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/portal?added=1");
}

/** "Let someone look after my records": an adult adds a Medfave login by its email. */
export async function grantCareAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePatientAccount();
  const result = await grantCare(me, formData.get("email"));
  if (!result.ok) return result;
  revalidatePath("/portal/details");
  return { ok: true, message: "Added. They can now see your visits at this clinic." };
}

/** An adult ends somebody's access to their records. */
export async function removeCareAction(formData: FormData) {
  const me = await requirePatientAccount();
  await removeCare(me, String(formData.get("linkId") ?? ""));
  revalidatePath("/portal/details");
  redirect("/portal/details");
}

/** A caregiver stepping back from the records they look after; back to their own. */
export async function stopCaringAction() {
  const me = await requirePatientAccount();
  const result = await stopCaring(me);
  if (result.ok) (await cookies()).delete(PORTAL_PERSON_COOKIE);
  redirect("/portal");
}

/** Add somebody to the family list: details only, on the patient's word. */
export async function addFamilyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const result = await addFamilyMember(viewer.accountId, Object.fromEntries(formData));
  if (!result.ok) return result;
  revalidatePath("/portal/family");
  return { ok: true, message: `${result.member.firstName} added.` };
}

export async function removeFamilyAction(formData: FormData) {
  const viewer = await requireViewer();
  await removeFamilyMember(viewer.accountId, String(formData.get("id") ?? ""));
  revalidatePath("/portal/family");
  redirect("/portal/family");
}

/** Stop looking after somebody on the family list: their chart leaves this login; they stay on the list, unlinked. */
export async function stopCaringForAction(formData: FormData) {
  const viewer = await requireViewer();
  await stopCaringFor(viewer.accountId, String(formData.get("patientId") ?? ""));
  (await cookies()).delete(PORTAL_PERSON_COOKIE);
  revalidatePath("/portal/family");
  redirect("/portal/family");
}

/** Choose the primary care physician on an emergency card (lib/emergency.ts). */
export async function choosePhysicianAction(formData: FormData) {
  const viewer = await requireViewer();
  const cardKey = String(formData.get("cardKey") ?? "");
  await choosePhysician(viewer, cardKey, String(formData.get("doctorId") ?? "") || null);
  revalidatePath("/portal/emergency");
  redirect(`/portal/emergency?person=${encodeURIComponent(cardKey)}`);
}
