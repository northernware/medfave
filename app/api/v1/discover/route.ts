import { apiError, apiViewer } from "@/lib/api";
import { listedSpecialties, searchDoctors } from "@/lib/discovery";

/**
 * "Find a doctor": verified doctors at clinics that list themselves.
 * `?q=` matches name, specialty, clinic or place; `?specialty=` narrows.
 * Any signed-in account → `{ doctors, specialties }`.
 */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const p = new URL(request.url).searchParams;
  const [doctors, specialties] = await Promise.all([
    searchDoctors(p.get("q") ?? "", p.get("specialty") ?? undefined),
    listedSpecialties(),
  ]);
  if (!doctors) return apiError(500, "Search failed.");
  return Response.json({ doctors, specialties });
}
