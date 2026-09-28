import { apiError, apiPatient } from "@/lib/api";
import { withdrawAppointmentRequest } from "@/lib/requests";

/** Withdraw one of the patient's own requests, while the clinic has not yet answered it. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/patient/requests/[id]">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;

  const { id } = await ctx.params;
  const withdrawn = await withdrawAppointmentRequest(me, id);
  // One answer for "not yours" and "doesn't exist", so ids can't be probed.
  if (!withdrawn) return apiError(404, "No open request with that id.");
  return Response.json({ id, status: "WITHDRAWN" });
}
