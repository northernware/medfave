import { apiError, apiViewer, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { resubmitPractice } from "@/lib/practice";

/**
 * A declined doctor sends corrected details for checking again.
 *
 * Body: `{ licenceName, licenseNumber, specialty? }`.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (!viewer.doctorId) return apiError(403, "This is for doctor accounts.");
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the details as JSON.");

  const result = await resubmitPractice(viewer.doctorId, body);
  if (!result.ok) return apiError(422, result.message ?? "Check the details.", result.fieldErrors);

  const fresh = await viewerForSession({ accountId: viewer.accountId, issuedAt: new Date() });
  return Response.json({ viewer: fresh ? viewerSummary(fresh) : null });
}
