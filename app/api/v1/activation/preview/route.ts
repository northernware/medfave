import { apiError, apiViewer, readJson } from "@/lib/api";
import { clientAddress, TOO_MANY } from "@/lib/rate-limit";
import { previewActivation } from "@/lib/sign-in";

/**
 * Whose record an activation code opens, without spending it — the app's
 * "Is this you?" before `/auth/activate` or `POST /patient/clinics`. Send the
 * returned `patientId` back with the code as `confirmedPatientId`.
 *
 * Body: `{ code }`. Signed in (Bearer token) or not: when signed in,
 * `emailDiffers` says whether the clinic's email is someone else's.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return apiError(400, "Send `{ code }` as JSON.");

  const viewer = request.headers.get("authorization") ? await apiViewer(request) : null;
  if (viewer instanceof Response) return viewer;

  const result = await previewActivation(
    body.code,
    viewer ? `code:account:${viewer.accountId}` : `code:address:${await clientAddress(request)}`,
    viewer?.email,
  );
  if (!result.ok) return apiError(result.message === TOO_MANY ? 429 : 422, result.message ?? "That code can't be used.", result.fieldErrors);
  return Response.json({ preview: result.preview });
}
