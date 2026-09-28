"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_CLINIC_COOKIE, requirePatientAccount, requireViewer } from "@/lib/auth";
import { linkPatientActivation } from "@/lib/sign-in";
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
  if (me.charts.some((c) => c.clinicId === clinicId)) await remember(clinicId);
  redirect("/portal");
}

/** "Add a clinic": another clinic's activation code joins that clinic's chart to this login. */
export async function addClinic(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const result = await linkPatientActivation(viewer.accountId, formData.get("code"));
  if (!result.ok) return result;
  await remember(result.clinicId);
  redirect("/portal?added=1");
}
