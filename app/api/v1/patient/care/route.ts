import { apiError, apiPatient } from "@/lib/api";
import { stopCaring } from "@/lib/caregivers";

/** A caregiver stops looking after the person chosen with `?patient=` → `204`. */
export async function DELETE(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const result = await stopCaring(me);
  if (!result.ok) return apiError(422, result.message);
  return new Response(null, { status: 204 });
}
