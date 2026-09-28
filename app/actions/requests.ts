"use server";

import { redirect } from "next/navigation";
import { requirePatientAccount, requireStaff } from "@/lib/auth";
import {
  acceptAppointmentRequest,
  createAppointmentRequest,
  declineAppointmentRequest,
  withdrawAppointmentRequest,
} from "@/lib/requests";
import type { FormState } from "@/lib/validation";

/*
 * The rules live in `lib/requests.ts`, shared with the app's API. These
 * actions read the form, call them, and decide where the browser goes next.
 */

/** A patient asking for a time. See `createAppointmentRequest`. */
export async function requestAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const patient = await requirePatientAccount();
  const result = await createAppointmentRequest(patient, {
    service: String(formData.get("service") ?? ""),
    preferredDate: String(formData.get("preferredDate") ?? ""),
    preferredTime: String(formData.get("preferredTime") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) return result;
  redirect("/portal?requested=1");
}

/** A patient changing their mind before the clinic has answered. */
export async function withdrawRequest(formData: FormData) {
  const patient = await requirePatientAccount();
  await withdrawAppointmentRequest(patient, String(formData.get("requestId") ?? ""));
}

/** Staff declining a request, with a reason the patient will read. */
export async function declineRequest(formData: FormData) {
  const staff = await requireStaff();
  const declined = await declineAppointmentRequest(
    staff,
    String(formData.get("requestId") ?? ""),
    String(formData.get("decisionNote") ?? ""),
  );
  if (declined) redirect("/desk/requests");
}

/** Staff accepting a request, which is the moment a slot is actually taken. See `acceptAppointmentRequest`. */
export async function acceptRequest(formData: FormData) {
  const staff = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const result = await acceptAppointmentRequest(staff, requestId, String(formData.get("time") ?? ""));
  if (result.ok) redirect(`/desk/appointments/${result.appointmentId}`);

  switch (result.reason) {
    case "needs-time":
      redirect(`/desk/requests?needs=time&id=${requestId}`);
    case "refused":
      redirect(`/desk/requests?refused=${encodeURIComponent(result.message)}&id=${requestId}`);
  }
}
