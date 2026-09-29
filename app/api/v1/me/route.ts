import { apiViewer, viewerSummary } from "@/lib/api";

/** Who the token belongs to — what the app checks on launch to pick patient or doctor. */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  return Response.json({ viewer: viewerSummary(viewer) });
}
