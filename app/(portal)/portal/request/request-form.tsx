"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { SERVICES } from "@/lib/domain";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export function RequestForm({
  action,
  earliest,
  latest,
  doctorId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  earliest: string;
  latest: string;
  /** The doctor this request is for; chosen above the form. */
  doctorId: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="doctorId" value={doctorId} />
      <FormError message={state.message} />

      <Field label="What is it about?" htmlFor="service" error={err?.service} required>
        <Select id="service" name="service" required defaultValue="GENERAL_CONSULTATION">
          {SERVICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <FieldGrid>
        <Field
          label="Preferred date"
          htmlFor="preferredDate"
          error={err?.preferredDate}
          required
        >
          <TextInput
            id="preferredDate"
            name="preferredDate"
            type="date"
            min={earliest}
            max={latest}
            required
            invalid={Boolean(err?.preferredDate)}
          />
        </Field>
        <Field
          label="Preferred time"
          htmlFor="preferredTime"
          error={err?.preferredTime}
          hint="Leave blank if any time that day would do."
        >
          <TextInput
            id="preferredTime"
            name="preferredTime"
            type="time"
            invalid={Boolean(err?.preferredTime)}
          />
        </Field>
      </FieldGrid>

      <Field
        label="Briefly, what do you need?"
        htmlFor="reason"
        error={err?.reason}
        hint="A sentence is enough. Do not put anything here you would not say at the desk."
        required
      >
        <TextArea id="reason" name="reason" rows={3} required />
      </Field>

      <div className="flex gap-2 border-t border-border pt-5">
        <SubmitButton>Send request</SubmitButton>
        <Link href="/portal" className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
