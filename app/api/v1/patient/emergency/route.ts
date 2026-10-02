import { apiError, apiViewer } from "@/lib/api";
import { emergencyCards } from "@/lib/emergency";

/**
 * Emergency cards for this login and everyone it looks after →
 * `{ cards: [{ key, name, dateOfBirth, self, general, clinics[] }] }`.
 * Read-only, straight from the clinics' records: `clinics` is each clinic's
 * own, `general` all of them side by side with each item's `clinics`, and
 * disagreements (a blood type) flagged, never settled.
 */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (viewer.charts.length === 0) return apiError(403, "This is for patient accounts.");
  return Response.json({ cards: await emergencyCards(viewer) });
}
