import { apiPatient, clinicBookingInfo } from "@/lib/api";

/**
 * The patient's clinic, and what the request form needs to know about it. See
 * `clinicBookingInfo`.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  return Response.json(await clinicBookingInfo(me.clinicId));
}
