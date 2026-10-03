import type { Metadata } from "next";
import Link from "next/link";
import { requirePatientAccount } from "@/lib/auth";
import { formatDate, instantFromDb } from "@/lib/datetime";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { orm } from "@/src/prisma/db";
import { PersonSwitch } from "@/components/person-switch";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Documents" };

/**
 * Documents the clinic chose to show this person: certificates, abstracts,
 * claim forms. Only what was shared to the portal, which is a separate act
 * from releasing it at the desk.
 */
export default async function PortalDocumentsPage() {
  const me = await requirePatientAccount();
  const documents = await orm.DocumentRequest
    .select("id", "type", "purpose", "sharedWithPatientAt")
    .include("doctor", (d) => d.select("fullName"))
    .where((d) => d.patientId.eq(me.patientId))
    .where((d) => d.sharedWithPatientAt.isNotNull())
    .orderBy((d) => d.sharedWithPatientAt.desc())
    .all();

  return (
    <div className="space-y-3">
      <PageHeader title="Documents" subtitle={`What ${me.clinicName} has shared with you.`} />
      <PersonSwitch />
      <Card className="overflow-hidden">
        {documents.length === 0 ? (
          <EmptyState
            title="Nothing shared yet"
            description="Certificates and other documents appear here when your clinic shares them."
          />
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id}>
                <Link href={`/portal/documents/${d.id}`} className="flex items-baseline gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {d.purpose} · {d.doctor.fullName}
                    </span>
                  </span>
                  <span className="text-sm text-ink-faint">Shared {formatDate(instantFromDb(d.sharedWithPatientAt!))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
