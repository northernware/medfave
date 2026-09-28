import { apiPatient } from "@/lib/api";
import { instantFromDb } from "@/lib/datetime";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { orm } from "@/src/prisma/db";

/**
 * Documents the clinic has chosen to share with this patient.
 *
 * Only those. A document being released at the desk is a different act from
 * publishing it here, as in the portal.
 */
export async function GET(request: Request) {
  const me = await apiPatient(request);
  if (me instanceof Response) return me;

  const documents = await orm.DocumentRequest
    .select("id", "type", "purpose", "sharedWithPatientAt")
    .where((d) => d.patientId.eq(me.patientId))
    .where((d) => d.sharedWithPatientAt.isNotNull())
    .orderBy((d) => d.sharedWithPatientAt.desc())
    .all();

  return Response.json({
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      typeLabel: DOCUMENT_TYPE_LABELS[d.type],
      purpose: d.purpose,
      sharedAt: instantFromDb(d.sharedWithPatientAt!).toISOString(),
    })),
  });
}
