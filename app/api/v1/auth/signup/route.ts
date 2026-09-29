import { apiError, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { clientAddress, hit, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { issueAppToken } from "@/lib/session";
import { createAccount } from "@/lib/sign-up";

/**
 * A new account, signed in at once. Unverified until the emailed link is
 * followed; it grants nothing clinical either way (plans/registration.md).
 *
 * Body: `{ fullName, email, password, confirmPassword, role: "PATIENT" | "DOCTOR", consent: true }`.
 */
export async function POST(request: Request) {
  if (!(await hit(`sign-up:address:${await clientAddress(request)}`, LIMITS.signUpAddress))) {
    return apiError(429, TOO_MANY);
  }
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the sign-up details as JSON.");

  const result = await createAccount(body);
  if (!result.ok) return apiError(422, result.message ?? "Check the details.", result.fieldErrors);

  const { token, expiresAt } = await issueAppToken(result.accountId);
  const viewer = await viewerForSession({ accountId: result.accountId, issuedAt: new Date() });
  if (!viewer) return apiError(500, "The account was created but could not be read back. Sign in instead.");
  return Response.json({ token, expiresAt: expiresAt.toISOString(), viewer: viewerSummary(viewer) }, { status: 201 });
}
