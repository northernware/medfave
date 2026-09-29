"use server";

import { redirect } from "next/navigation";
import { getViewer, homeFor, requireViewer } from "@/lib/auth";
import { clientAddress, hit, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { appReturnUrl, completeGoogleSignUp, issueHandoff } from "@/lib/google";
import { createSession } from "@/lib/session";
import { createAccount, sendVerification, verifyEmail } from "@/lib/sign-up";
import type { FormState } from "@/lib/validation";

/** Open sign-up: a new account, signed in straight away. See `createAccount`. */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await hit(`sign-up:address:${await clientAddress()}`, LIMITS.signUpAddress))) return { message: TOO_MANY };
  const result = await createAccount(Object.fromEntries(formData));
  if (!result.ok) return result;

  await createSession(result.accountId);
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
}

/** The last step of a Google sign-up: role and consent. Back to the app if it started there. See `completeGoogleSignUp`. */
export async function finishGoogleSignUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await hit(`sign-up:address:${await clientAddress()}`, LIMITS.signUpAddress))) return { message: TOO_MANY };
  const result = await completeGoogleSignUp(Object.fromEntries(formData));
  if (!result.ok) return result;

  if (result.app) redirect(appReturnUrl(result.app, { code: await issueHandoff(result.accountId, result.app) }));
  await createSession(result.accountId);
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
}

/** Spends the emailed link. A button press, not the page load: mail scanners open links, and would use it up. */
export async function confirmEmail(formData: FormData) {
  const verified = await verifyEmail(String(formData.get("code") ?? ""));
  redirect(verified ? "/verify-email?done=1" : "/verify-email?failed=1");
}

/** Another verification link, for the signed-in account. */
export async function resendVerification(): Promise<FormState> {
  const viewer = await requireViewer();
  if (viewer.emailVerified) return { ok: true, message: "Your email is already confirmed." };
  if (!(await hit(`email-send:${viewer.email}`, LIMITS.emailSends))) return { message: TOO_MANY };
  await sendVerification(viewer.accountId);
  return { ok: true, message: `A new link is on its way to ${viewer.email}. Check the spam folder if it doesn't arrive.` };
}
