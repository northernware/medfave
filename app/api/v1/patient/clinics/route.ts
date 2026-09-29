import { apiError, apiPatient, apiViewer, readJson } from "@/lib/api";
import { linkPatientActivation } from "@/lib/sign-in";

/** Every clinic this patient login is linked to. Pass one's `id` as `?clinic=` to the other patient endpoints. */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  return Response.json({
    clinics: me.charts.map((c) => ({ id: c.clinicId, name: c.clinicName, patientId: c.id })),
  });
}

/**
 * "Add a clinic": redeem another clinic's activation code, and its chart joins
 * this login. Body: `{ code }`. Open to any signed-in account — a first code is
 * how an account with no clinic yet becomes a patient.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;

  const body = await readJson(request);
  if (!body) return apiError(400, "Send `{ code }` as JSON.");

  const result = await linkPatientActivation(viewer.accountId, body.code);
  if (!result.ok) return apiError(422, result.message ?? "That code can't be used.", result.fieldErrors);
  return Response.json({ clinic: { id: result.clinicId, name: result.clinicName } }, { status: 201 });
}
