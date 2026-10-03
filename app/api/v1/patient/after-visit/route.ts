import { apiPatient } from "@/lib/api";
import { visitToAskAbout } from "@/lib/faves";

/**
 * The finished visit to ask "How was it?" about, if any:
 * `{ visit: { id, scheduledAt, serviceLabel, doctor: { id, fullName }, faved } | null }`.
 * The latest completed visit of this person in the last two weeks that this
 * login hasn't answered or closed.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  return Response.json({ visit: await visitToAskAbout(me) });
}
