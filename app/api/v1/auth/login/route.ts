import { apiError, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { issueAppToken } from "@/lib/session";
import { checkCredentials } from "@/lib/sign-in";

/**
 * Email and password for an app token.
 *
 * The same check as the web sign-in form. The app keeps the token and sends it
 * as `Authorization: Bearer <token>`; signing out is the app forgetting it.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return apiError(400, "Send email and password as JSON.");

  const result = await checkCredentials(body);
  if (!result.ok) return apiError(401, result.message ?? "Email or password is incorrect.", result.fieldErrors);

  const { token, expiresAt } = await issueAppToken(result.accountId);
  const viewer = await viewerForSession({ accountId: result.accountId, issuedAt: new Date() });
  if (!viewer) return apiError(401, "Email or password is incorrect.");

  return Response.json({ token, expiresAt: expiresAt.toISOString(), viewer: viewerSummary(viewer) });
}
