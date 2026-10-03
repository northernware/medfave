import { apiError, apiViewer } from "@/lib/api";
import { setFave } from "@/lib/faves";

/** Faves a verified doctor → `{ doctorId, faved: true }`. Faving twice is fine. */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/faves/[doctorId]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const { doctorId } = await ctx.params;
  const result = await setFave(viewer.accountId, doctorId, true);
  if (!result.ok) return apiError(404, "No doctor with that id.");
  return Response.json({ doctorId, faved: true });
}

/** Un-faves → `{ doctorId, faved: false }`. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/faves/[doctorId]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const { doctorId } = await ctx.params;
  await setFave(viewer.accountId, doctorId, false);
  return Response.json({ doctorId, faved: false });
}
