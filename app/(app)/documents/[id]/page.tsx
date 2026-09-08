import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocumentRequest, setDocumentStatus } from "@/app/actions/documents";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatDateTime, instantFromDb } from "@/lib/datetime";
import { ageFrom, fullName, SEX_LABELS } from "@/lib/domain";
import {
  DOCUMENT_ACTION_LABELS,
  DOCUMENT_FIELDS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  DOCUMENT_TRANSITIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_RESTRICTIONS,
  parseDetails,
} from "@/lib/documents";
import { DangerZone } from "@/components/danger-zone";
import { Badge, buttonClass, Card, CardHeader, Detail, PageHeader, Prose } from "@/components/ui";

export const metadata: Metadata = { title: "Document request" };

export default async function DocumentPage({ params, searchParams }: PageProps<"/documents/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const { blocked, needs } = await searchParams;

  const request = await orm.DocumentRequest
    .include("patient", (p) =>
      p
        .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "patientNumber")
        .include("household", (h) => h.select("id", "name")),
    )
    .include("medicalRecord", (r) => r.select("id", "visitDate", "chiefComplaint"))
    .include("releasedBy", (d) => d.select("id", "fullName"))
    .where((r) => r.id.eq(id))
    .where((r) => r.doctorId.eq(doctor.id))
    .first();
  if (!request) notFound();

  const { patient } = request;
  const details = parseDetails(request.details);
  const moves = DOCUMENT_TRANSITIONS[request.status];
  const restriction = DOCUMENT_TYPE_RESTRICTIONS[request.type];

  return (
    <div className="space-y-6">
      <PageHeader
        title={DOCUMENT_TYPE_LABELS[request.type]}
        subtitle={
          <>
            <Link href={`/patients/${patient.id}`} className="text-accent-ink hover:underline">
              {fullName(patient)}
            </Link>
            {" · "}
            {SEX_LABELS[patient.sex]} · {ageFrom(calendarDateFromDb(patient.dateOfBirth))}
            {patient.patientNumber ? ` · ${patient.patientNumber}` : ""}
          </>
        }
        actions={
          <>
            <Link href={`/documents/${request.id}/print`} className={buttonClass("primary")}>
              Open document
            </Link>
            {request.status === "RELEASED" ? null : (
              <Link href={`/documents/${request.id}/edit`} className={buttonClass("secondary")}>
                Edit particulars
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge dot tone={DOCUMENT_STATUS_TONE[request.status]}>
          {DOCUMENT_STATUS_LABELS[request.status]}
        </Badge>
        {restriction ? <Badge tone="neutral">{restriction}</Badge> : null}
      </div>

      {blocked ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-[13px]">
          <p className="font-medium">That change is not available from here.</p>
          <p className="mt-0.5 text-ink-muted">
            The request has moved on since the page was loaded.
          </p>
        </div>
      ) : null}

      {needs === "releasedTo" ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]">
          <p className="font-medium text-danger-ink">Say who received it.</p>
          <p className="mt-0.5 text-ink-muted">
            A document leaving the clinic with no note of who took it answers none of the questions
            asked afterwards.
          </p>
        </div>
      ) : null}
      {needs === "declineReason" ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]">
          <p className="font-medium text-danger-ink">Say why it was declined.</p>
        </div>
      ) : null}

      {request.status === "RELEASED" ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-[13px]">
          <p className="font-medium text-ok-ink">
            Released {formatDateTime(instantFromDb(request.releasedAt!))}
            {request.releasedBy ? ` by ${request.releasedBy.fullName}` : ""}.
          </p>
          <p className="mt-0.5 text-ink-muted">Handed to {request.releasedTo}.</p>
        </div>
      ) : null}
      {request.status === "DECLINED" ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-[13px]">
          <p className="font-medium">Declined.</p>
          <p className="mt-0.5 text-ink-muted">{request.declineReason}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="The request" />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Detail label="Requested by" value={request.requesterName} />
          <Detail label="Relationship to patient" value={request.requesterRelation} />
          <Detail label="Purpose" value={request.purpose} />
          <Detail label="Recorded" value={formatDateTime(instantFromDb(request.createdAt))} />
          <Detail
            label="Drawn from"
            value={
              request.medicalRecord ? (
                <Link
                  href={`/records/${request.medicalRecord.id}`}
                  className="text-accent-ink hover:underline"
                >
                  {formatDateTime(instantFromDb(request.medicalRecord.visitDate))} —{" "}
                  {request.medicalRecord.chiefComplaint || "Untitled"}
                </Link>
              ) : null
            }
          />
        </dl>
        {request.notes ? (
          <div className="border-t border-border px-5 py-4">
            <Prose label="Notes" text={request.notes} />
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="What the document states"
          subtitle="These are the particulars printed on it."
        />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {DOCUMENT_FIELDS[request.type].map((field) => (
            <Detail
              key={field.name}
              label={field.label}
              value={details[field.name] || null}
            />
          ))}
        </dl>
      </Card>

      {moves.length > 0 ? (
        <Card>
          <CardHeader title="Move it along" />
          <div className="space-y-4 px-5 py-4">
            {moves.map((next) => (
              <form key={next} action={setDocumentStatus} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value={next} />
                {/* Releasing and declining each need one more fact before they
                    mean anything, so each is asked for beside its own button. */}
                {next === "RELEASED" ? (
                  <label className="min-w-56 flex-1">
                    <span className="mb-1.5 block text-sm font-medium">Handed to</span>
                    <input
                      name="releasedTo"
                      required
                      placeholder="Name of whoever collected it"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                    />
                  </label>
                ) : null}
                {next === "DECLINED" ? (
                  <label className="min-w-56 flex-1">
                    <span className="mb-1.5 block text-sm font-medium">Reason</span>
                    <input
                      name="declineReason"
                      required
                      placeholder="Not authorised to receive this"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
                    />
                  </label>
                ) : null}
                <button className={buttonClass(next === "DECLINED" ? "secondary" : "primary")}>
                  {DOCUMENT_ACTION_LABELS[next]}
                </button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}

      {request.status === "RELEASED" ? null : (
        <DangerZone
          action={deleteDocumentRequest}
          fieldName="requestId"
          fieldValue={request.id}
          variant="secondary"
          summary="Withdraw this request"
          warning="Removes the request. Nothing has gone out, so there is nothing to keep a record of — a document that has been handed over cannot be withdrawn this way."
          confirmLabel="Withdraw request"
        />
      )}
    </div>
  );
}
