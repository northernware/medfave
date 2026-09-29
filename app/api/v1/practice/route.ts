import { apiError, apiViewer, readJson, viewerSummary } from "@/lib/api";
import { viewerForSession } from "@/lib/auth";
import { createPractice } from "@/lib/practice";

/**
 * A signed-up doctor creates their clinic, as `/welcome` does on the web. The
 * clinic opens once a Medfave admin verifies the licence.
 *
 * Body: `{ licenceName, licenseNumber, specialty?, clinicName, address, contactNumber }`.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the practice details as JSON.");

  const result = await createPractice(viewer.accountId, body);
  if (!result.ok) return apiError(422, result.message ?? "Check the details.", result.fieldErrors);

  const fresh = await viewerForSession({ accountId: viewer.accountId, issuedAt: new Date() });
  return Response.json({ viewer: fresh ? viewerSummary(fresh) : null }, { status: 201 });
}

