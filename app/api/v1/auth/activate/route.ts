import { apiError, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { issueAppToken } from "@/lib/session";
import { activatePatient } from "@/lib/sign-in";

/**
 * A patient's activation code for a new login and an app token — the app's
 * version of the web's "Activate your account". See `activatePatient`.
 *
 * Body: `{ code, fullName, email, password, confirmPassword }`.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the activation details as JSON.");

  const result = await activatePatient(body);
  if (!result.ok) return apiError(422, result.message ?? "Check the details.", result.fieldErrors);

  const { token, expiresAt } = await issueAppToken(result.accountId);
  const viewer = await viewerForSession({ accountId: result.accountId, issuedAt: new Date() });
  if (!viewer) return apiError(500, "The account was created but could not be read back. Sign in instead.");

  return Response.json(
    { token, expiresAt: expiresAt.toISOString(), viewer: viewerSummary(viewer) },
    { status: 201 },
  );
}
