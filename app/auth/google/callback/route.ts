import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appReturnUrl, finishGoogle, issueHandoff } from "@/lib/google";
import { getViewer, homeFor } from "@/lib/auth";
import { createSession } from "@/lib/session";

/** Where Google sends the browser back. Registered in the Google Cloud console as `${APP_URL}/auth/google/callback`. */
export async function GET(request: NextRequest) {
  const outcome = await finishGoogle(request.nextUrl.searchParams);

  if (outcome.kind === "error") {
    redirect(outcome.app ? appReturnUrl(outcome.app, { error: outcome.reason }) : `/login?google=${outcome.reason}`);
  }
  // New here: choose patient or doctor, and consent, in this same browser.
  if (outcome.kind === "new") redirect("/signup/google");

  if (outcome.app) redirect(appReturnUrl(outcome.app, { code: await issueHandoff(outcome.accountId, outcome.app) }));
  await createSession(outcome.accountId);
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer) : "/login");
}
