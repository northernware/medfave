import { apiError, apiPatient, readJson } from "@/lib/api";
import { TOO_MANY } from "@/lib/rate-limit";
import { carersOf, grantCare } from "@/lib/caregivers";

/**
 * Who can see this patient's own records at the clinic →
 * `{ carers: [{ id, name, email, since }], canManage }`. `canManage`: an adult
 * decides for themselves; a child's are the desk's. `404` when the chart shown
 * is somebody else's (`?patient=` a person looked after).
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const care = await carersOf(me);
  if (!care) return apiError(404, "These aren't your own records.");
  return Response.json(care);
}

/** "Let someone look after me". Body: `{ email }` of their Medfave login → `201`. Adults only. */
export async function POST(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send `{ email }` as JSON.");
  const result = await grantCare(me, body.email);
  if (!result.ok) return apiError(result.message === TOO_MANY ? 429 : 422, result.message, result.fieldErrors);
  return Response.json(await carersOf(me), { status: 201 });
}
