"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { DocumentType } from "@/lib/enums";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import {
  DOCUMENT_FIELDS,
  DOCUMENT_TYPE_BLURBS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_RESTRICTIONS,
  DOCUMENT_TYPES,
  type DocumentDetails,
} from "@/lib/documents";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export type DocumentDefaults = {
  patientId: string;
  type: DocumentType;
  medicalRecordId: string;
  purpose: string;
  requesterName: string;
  requesterRelation: string;
  notes: string;
  details: DocumentDetails;
};

export function DocumentForm({
  action,
  defaults,
  patients,
  visits,
  submitLabel,
  cancelHref,
  /** Set when editing: the document is decided, only its particulars change. */
  lockedType = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: DocumentDefaults;
  patients: { id: string; label: string; householdName: string }[];
  /** Visits per patient, so a document can name the one it draws on. */
  visits: Record<string, { id: string; label: string }[]>;
  submitLabel: string;
  cancelHref: string;
  lockedType?: boolean;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  const [patientId, setPatientId] = useState(defaults.patientId);
  const [type, setType] = useState<DocumentType>(defaults.type);

  const fields = DOCUMENT_FIELDS[type];
  const patientVisits = visits[patientId] ?? [];

  const byHousehold = patients.reduce<Record<string, typeof patients>>((acc, p) => {
    (acc[p.householdName] ??= []).push(p);
    return acc;
  }, {});

  return (
    <form action={formAction} className="space-y-7">
      <FormError message={state.message} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Who and what</h2>

        <FieldGrid>
          <Field label="Patient" htmlFor="patientId" error={err?.patientId} required>
            <Select
              id="patientId"
              name="patientId"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              disabled={lockedType}
            >
              <option value="" disabled>
                Select a patient…
              </option>
              {Object.entries(byHousehold).map(([household, members]) => (
                <optgroup key={household} label={household}>
                  {members.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {/* A disabled select posts nothing, so the value still has to travel. */}
            {lockedType ? <input type="hidden" name="patientId" value={patientId} /> : null}
          </Field>

          <Field
            label="Document"
            htmlFor="type"
            error={err?.type}
            hint={DOCUMENT_TYPE_RESTRICTIONS[type]}
            required
          >
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              required
              disabled={lockedType}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                  {DOCUMENT_TYPE_RESTRICTIONS[t] ? ` — ${DOCUMENT_TYPE_RESTRICTIONS[t]}` : ""}
                </option>
              ))}
            </Select>
            {lockedType ? <input type="hidden" name="type" value={type} /> : null}
          </Field>
        </FieldGrid>

        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-[13px] text-ink-muted">
          {DOCUMENT_TYPE_BLURBS[type]}
        </p>

        <Field
          label="Draw from a visit"
          htmlFor="medicalRecordId"
          error={err?.medicalRecordId}
          hint={
            patientId && patientVisits.length === 0
              ? "This patient has no recorded visits to draw from."
              : "Optional. Naming the visit keeps the document tied to what it came from."
          }
        >
          <Select
            id="medicalRecordId"
            name="medicalRecordId"
            defaultValue={defaults.medicalRecordId}
            disabled={patientVisits.length === 0}
          >
            <option value="">Not from a particular visit</option>
            {patientVisits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Who is asking</h2>
          <p className="text-sm text-ink-muted">
            Every one of these releases clinical information to somebody. Who asked and what for is
            part of the record.
          </p>
        </div>

        <FieldGrid>
          <Field label="Requested by" htmlFor="requesterName" error={err?.requesterName} required>
            <TextInput
              id="requesterName"
              name="requesterName"
              defaultValue={defaults.requesterName}
              required
              placeholder="Ramon Dela Cruz"
              invalid={Boolean(err?.requesterName)}
            />
          </Field>
          <Field
            label="Relationship to patient"
            htmlFor="requesterRelation"
            error={err?.requesterRelation}
            required
          >
            <TextInput
              id="requesterRelation"
              name="requesterRelation"
              defaultValue={defaults.requesterRelation}
              required
              placeholder="Self, parent, employer, insurer…"
              invalid={Boolean(err?.requesterRelation)}
            />
          </Field>
        </FieldGrid>

        <Field label="Purpose" htmlFor="purpose" error={err?.purpose} required>
          <TextInput
            id="purpose"
            name="purpose"
            defaultValue={defaults.purpose}
            required
            placeholder="Return to work · school requirement · insurance claim"
            invalid={Boolean(err?.purpose)}
          />
        </Field>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">{DOCUMENT_TYPE_LABELS[type]}</h2>
          <p className="text-sm text-ink-muted">What this document has to state.</p>
        </div>

        <FieldGrid>
          {fields.map((field) => {
            const name = `d.${field.name}`;
            const value = defaults.details[field.name] ?? "";
            return (
              <Field
                key={field.name}
                label={field.label}
                htmlFor={name}
                error={err?.[name]}
                hint={field.hint}
                required={field.required}
                className={field.wide ? "sm:col-span-2" : undefined}
              >
                {field.kind === "textarea" ? (
                  <TextArea id={name} name={name} rows={3} defaultValue={value} />
                ) : (
                  <TextInput
                    id={name}
                    name={name}
                    type={
                      field.kind === "date"
                        ? "date"
                        : field.kind === "datetime"
                          ? "datetime-local"
                          : field.kind === "number"
                            ? "number"
                            : "text"
                    }
                    step={field.kind === "number" ? "0.01" : undefined}
                    defaultValue={value}
                    invalid={Boolean(err?.[name])}
                  />
                )}
              </Field>
            );
          })}
        </FieldGrid>
      </section>

      <section className="border-t border-border pt-6">
        <Field label="Notes for the records desk" htmlFor="notes" error={err?.notes}>
          <TextArea id="notes" name="notes" rows={2} defaultValue={defaults.notes} />
        </Field>
      </section>

      <div className="flex gap-2 border-t border-border pt-6">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
