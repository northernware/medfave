import { apiError, apiViewer, readJson } from "@/lib/api";
import { removeFamilyMember, updateFamilyMember } from "@/lib/family";

/** Change somebody's details. Body as for `POST /family` → `{ member }`. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/v1/family/[id]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the person as JSON.");
  const result = await updateFamilyMember(viewer.accountId, (await params).id, body);
  if (!result.ok) return apiError(result.message === "Not found." ? 404 : 422, result.message ?? "Check the details.", result.fieldErrors);
  return Response.json({ member: result.member });
}

/** Take somebody off the list. Requests already sent for them stand. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/v1/family/[id]">) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (!(await removeFamilyMember(viewer.accountId, (await params).id))) return apiError(404, "Not found.");
  return new Response(null, { status: 204 });
}
