import { apiError, apiViewer, readJson } from "@/lib/api";
import { addFamilyMember, listFamily } from "@/lib/family";

/**
 * The people this login books for → `{ family: [{ id, firstName, middleName,
 * lastName, dateOfBirth, sex, relationship }] }`. Details on the account
 * holder's word; they grant nothing at any clinic.
 */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  return Response.json({ family: await listFamily(viewer.accountId) });
}

/** Add somebody. Body: `{ firstName, middleName?, lastName, dateOfBirth, sex, relationship }` → `201 { member }`. */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the person as JSON.");
  const result = await addFamilyMember(viewer.accountId, body);
  if (!result.ok) return apiError(422, result.message ?? "Check the details.", result.fieldErrors);
  return Response.json({ member: result.member }, { status: 201 });
}
