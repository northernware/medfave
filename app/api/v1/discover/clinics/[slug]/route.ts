import { apiError, apiViewer } from "@/lib/api";
import { clinicBySlug } from "@/lib/discovery";

/** A clinic by its link (listed or not), with its verified doctors. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/discover/clinics/[slug]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const { slug } = await ctx.params;
  const found = await clinicBySlug(slug);
  if (!found) return apiError(404, "No clinic at that link.");
  return Response.json(found);
}
