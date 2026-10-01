import { apiError, apiPatient } from "@/lib/api";
import { cancelByPatient } from "@/lib/patient-visits";

/**
 * The patient cancelling one of their visits, up to the clinic's cut-off
 * (`cancelHours` on GET /patient/appointments). → `{ id, status: "CANCELLED" }`;
 * `409` with what to do instead when it's too late or already settled.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/patient/appointments/[id]/cancel">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const result = await cancelByPatient(me, id);
  if (!result.ok) return apiError(result.status, result.message);
  return Response.json({ id, status: "CANCELLED" });
}
