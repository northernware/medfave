import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatientAccount } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { formatDateTime, instantFromDb } from "@/lib/datetime";
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABELS, parseDetails } from "@/lib/documents";
import { buttonClass, Card, CardHeader, Detail, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Document" };

export default async function PortalDocumentPage({ params }: PageProps<"/portal/documents/[id]">) {
  const me = await requirePatientAccount();
  const { id } = await params;

  // Two conditions, both required: it is this patient's, and the clinic chose
  // to publish it here. Being released at the desk is not enough — that is a
  // different act, and a document handed to an employer is not one the patient
  // has necessarily been given.
  const document = await orm.DocumentRequest
    .select("id", "type", "purpose", "details", "sharedWithPatientAt", "releasedAt")
    .include("doctor", (d) => d.select("fullName"))
    .where((d) => d.id.eq(id))
    .where((d) => d.patientId.eq(me.patientId))
    .where((d) => d.sharedWithPatientAt.isNotNull())
    .first();
  if (!document) notFound();

  const details = parseDetails(document.details);

  return (
    <div className="space-y-6">
      <PageHeader
        title={DOCUMENT_TYPE_LABELS[document.type]}
        subtitle={`Shared with you ${formatDateTime(instantFromDb(document.sharedWithPatientAt!))}`}
        actions={
          <Link href="/portal" className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />

      <Card>
        <CardHeader title="What it says" subtitle={document.purpose} />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {DOCUMENT_FIELDS[document.type].map((field) => (
            <Detail key={field.name} label={field.label} value={details[field.name] || null} />
          ))}
        </dl>
      </Card>

      <p className="text-[13px] text-ink-muted">
        Prepared by {document.doctor.fullName}. For a printed and signed copy, ask the clinic.
      </p>
    </div>
  );
}
