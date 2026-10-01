import { apiError, apiPatient } from "@/lib/api";
import { removeCare } from "@/lib/caregivers";

/** An adult ends somebody's access to their records → `204`. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/v1/patient/carers/[id]">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const result = await removeCare(me, (await params).id);
  if (!result.ok) return apiError(result.message === "Not found." ? 404 : 403, result.message);
  return new Response(null, { status: 204 });
}
