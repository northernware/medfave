import { apiError, apiPatient, readJson } from "@/lib/api";
import { saveFeedback } from "@/lib/faves";

/**
 * What the patient thought of a finished visit, for the clinic only:
 * `{ rating?: "GOOD" | "NOT_GREAT", note? }` → `{ id, saved: true }`. Leaving
 * `rating` out records the card as closed, so it isn't asked again.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/patient/appointments/[id]/feedback">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};

  const rating = body.rating ?? null;
  if (rating !== null && rating !== "GOOD" && rating !== "NOT_GREAT") {
    return apiError(422, "Rating is GOOD or NOT_GREAT.", { rating: ["Choose good or not great"] });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const result = await saveFeedback(me, id, rating, note);
  if (!result.ok) return apiError(result.status, result.message);
  return Response.json({ id, saved: true });
}
