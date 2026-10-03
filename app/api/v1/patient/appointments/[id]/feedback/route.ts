import { apiError, apiPatient, readJson } from "@/lib/api";
import { FEEDBACK_TAGS, saveFeedback, type FeedbackTag } from "@/lib/faves";

/**
 * What the patient thought of a finished visit, for the clinic only:
 * `{ score?: 1–5, tags?: string[], note? }` → `{ id, saved: true }`. Tags are
 * codes from `FEEDBACK_TAGS`. Leaving `score` out records the sheet as closed,
 * so it isn't asked again. (`rating: "GOOD" | "NOT_GREAT"` is still accepted,
 * from the app's first version.)
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/patient/appointments/[id]/feedback">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};

  const score = body.score ?? null;
  if (score !== null && !(Number.isInteger(score) && (score as number) >= 1 && (score as number) <= 5)) {
    return apiError(422, "Score is a whole number from 1 to 5.", { score: ["Choose a face"] });
  }
  const rating = body.rating ?? null;
  if (rating !== null && rating !== "GOOD" && rating !== "NOT_GREAT") {
    return apiError(422, "Rating is GOOD or NOT_GREAT.", { rating: ["Choose good or not great"] });
  }
  const tags = Array.isArray(body.tags) ? body.tags : [];
  if (!tags.every((t): t is FeedbackTag => (FEEDBACK_TAGS as readonly unknown[]).includes(t))) {
    return apiError(422, "Unknown tag.", { tags: ["Choose from the tags shown"] });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const result = await saveFeedback(me, id, { score: score as number | null, rating, tags: [...new Set(tags)], note });
  if (!result.ok) return apiError(result.status, result.message);
  return Response.json({ id, saved: true });
}
