import { apiDoctor, apiError, readJson } from "@/lib/api";
import { startOwnHouseholdFor } from "@/lib/households";

/**
 * Start their own household: this adult becomes head of a new one, and the
 * housemates named in `{ memberIds }` move with them → `201 { household: { id, name } }`.
 * A move, never a copy; `422` for a child or an archived chart.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/patients/[id]/household">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;
  const body = (await readJson(request)) ?? {};
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(String) : [];
  const result = await startOwnHouseholdFor(doctor, id, memberIds);
  if (!result.ok) return apiError(422, result.message);
  return Response.json({ household: { id: result.householdId, name: result.name } }, { status: 201 });
}
