import { apiError, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { redeemHandoff } from "@/lib/google";
import { issueAppToken } from "@/lib/session";

/**
 * The end of "Continue with Google" in the app: the one-time code from the
 * return link, and the PKCE verifier the app kept, for an app token.
 *
 * Body: `{ code, verifier }`.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";

  const accountId = code && verifier ? await redeemHandoff(code, verifier) : null;
  if (!accountId) return apiError(401, "That Google sign-in didn't finish. Try again.");

  const { token, expiresAt } = await issueAppToken(accountId);
  const viewer = await viewerForSession({ accountId, issuedAt: new Date() });
  if (!viewer) return apiError(401, "That Google sign-in didn't finish. Try again.");
  return Response.json({ token, expiresAt: expiresAt.toISOString(), viewer: viewerSummary(viewer) });
}
