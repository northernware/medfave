"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_CLINIC_COOKIE, PORTAL_PERSON_COOKIE, requirePatientAccount, requireViewer } from "@/lib/auth";
import { linkPatientActivation, previewActivation, type ActivationPreview } from "@/lib/sign-in";
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
