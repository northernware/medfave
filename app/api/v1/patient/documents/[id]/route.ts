import { apiError, apiPatient } from "@/lib/api";
import { instantFromDb } from "@/lib/datetime";
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABELS, parseDetails } from "@/lib/documents";
import { orm } from "@/src/prisma/db";

/**
 * One shared document, with its fields in the order the clinic's form shows
 * them. Both conditions hold, as in the portal: it is this patient's, and the
 * clinic chose to publish it here.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/patient/documents/[id]">) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;
  const { id } = await ctx.params;

  const document = await orm.DocumentRequest
    .select("id", "type", "purpose", "details", "sharedWithPatientAt")
    .include("doctor", (d) => d.select("fullName"))
    .where((d) => d.id.eq(id))
    .where((d) => d.patientId.eq(me.patientId))
    .where((d) => d.sharedWithPatientAt.isNotNull())
    .first();
  if (!document) return apiError(404, "No shared document with that id.");

  const details = parseDetails(document.details);

  return Response.json({
    document: {
      id: document.id,
      type: document.type,
      typeLabel: DOCUMENT_TYPE_LABELS[document.type],
      purpose: document.purpose,
      sharedAt: instantFromDb(document.sharedWithPatientAt!).toISOString(),
      preparedBy: document.doctor.fullName,
      fields: DOCUMENT_FIELDS[document.type].map((field) => ({
        name: field.name,
        label: field.label,
        value: details[field.name] || null,
      })),
    },
  });
}
