import { apiViewer } from "@/lib/api";
import { listFaves } from "@/lib/faves";

/** The doctors this login has faved, newest first: `{ doctors: FoundDoctor[] }`. */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  return Response.json({ doctors: await listFaves(viewer.accountId) });
}
