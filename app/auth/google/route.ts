import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { appReturn, googleConfigured, startGoogle } from "@/lib/google";
import { appUrl } from "@/lib/email";
import { SignupRole } from "@/lib/enums";

/**
 * Starts "Continue with Google", for the web and for the app.
 *
 * Query: `as=doctor` picks the role shown if this turns out to be a new
 * person. The app adds `app=<its return link>&challenge=<PKCE S256 challenge>`
 * (see docs/api.md).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The state cookie must be set on the host Google will send the browser back
  // to (APP_URL), so a visit on another name for this server goes there first.
  const home = new URL(appUrl("/"));
  if (request.headers.get("host") !== home.host) {
    redirect(appUrl(`/auth/google${request.nextUrl.search}`));
  }

  const app = appReturn(params.get("app"), params.get("challenge"));
  if (params.get("app") && !app) return new Response("That return link isn't allowed.", { status: 400 });
  if (!googleConfigured()) {
    redirect(app ? `${app.returnTo}${app.returnTo.includes("?") ? "&" : "?"}error=unavailable` : "/login?google=unavailable");
  }

  const as = params.get("as") === "doctor" ? SignupRole.DOCTOR : params.get("as") === "patient" ? SignupRole.PATIENT : null;
  redirect((await startGoogle({ app, as })).toString());
}
