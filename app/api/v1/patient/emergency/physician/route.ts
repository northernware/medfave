import { apiError, apiViewer, readJson } from "@/lib/api";
import { choosePhysician } from "@/lib/emergency";

/**
 * Choose the primary care physician on an emergency card. Body:
 * `{ cardKey, doctorId }` — `cardKey` from `GET /patient/emergency`, `doctorId`
 * one of a clinic record's `doctorsSeen`, or null to let the card work it out.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send `{ cardKey, doctorId }` as JSON.");
  const result = await choosePhysician(viewer, String(body.cardKey ?? ""), body.doctorId ? String(body.doctorId) : null);
  if (!result.ok) return apiError(422, result.message);
  return new Response(null, { status: 204 });
}
