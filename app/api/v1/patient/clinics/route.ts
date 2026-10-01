import { apiError, apiPatient, apiViewer, readJson } from "@/lib/api";
import { TOO_MANY } from "@/lib/rate-limit";
import { linkPatientActivation } from "@/lib/sign-in";

/** Every clinic this patient login is linked to. Pass one's `id` as `?clinic=` to the other patient endpoints. */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  return Response.json({
    // One row per chart: a clinic appears twice when this login has its own
    // chart there and looks after somebody else's. `self` tells them apart.
    clinics: me.charts.map((c) => ({ id: c.clinicId, name: c.clinicName, patientId: c.id, self: c.self, personName: c.name })),
  });
}

/**
 * "Add a clinic": redeem another clinic's activation code, and its chart joins
 * this login. Body: `{ code, confirmedPatientId }` — the `patientId` from
 * `POST /activation/preview`, once the person said it's them. (Optional for
 * now, for app builds from before the preview; required once they're gone.) Open to any signed-in account — a first code is
 * how an account with no clinic yet becomes a patient.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;

  const body = await readJson(request);
  if (!body) return apiError(400, "Send `{ code }` as JSON.");

  const result = await linkPatientActivation(viewer.accountId, body.code, body.confirmedPatientId);
  if (!result.ok) return apiError(result.message === TOO_MANY ? 429 : 422, result.message ?? "That code can't be used.", result.fieldErrors);
  return Response.json({ clinic: { id: result.clinicId, name: result.clinicName }, patientId: result.patientId }, { status: 201 });
}
