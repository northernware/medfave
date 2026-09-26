"use client";

import { useActionState } from "react";
import { Field, FieldGrid, FormError, Select, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export function ContactForm({
  action,
  defaults,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: { contactNumber: string; email: string; reminderPreference: string };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message} />

      <FieldGrid>
        <Field
          label="Mobile number"
          htmlFor="contactNumber"
          error={err?.contactNumber}
          hint="Where the clinic rings or texts you."
        >
          <TextInput
            id="contactNumber"
            name="contactNumber"
            type="tel"
            autoComplete="tel"
            defaultValue={defaults.contactNumber}
            placeholder="0917 000 0000"
            invalid={Boolean(err?.contactNumber)}
          />
        </Field>
        <Field
          label="Email for reminders"
          htmlFor="email"
          error={err?.email}
          hint="Where confirmations and reminders are sent."
        >
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaults.email}
            placeholder="you@example.com"
            invalid={Boolean(err?.email)}
          />
        </Field>
      </FieldGrid>

      <Field
        label="Reminders"
        htmlFor="reminderPreference"
        error={err?.reminderPreference}
        hint="A reminder goes out the day before a visit, to the address above."
      >
        <Select
          id="reminderPreference"
          name="reminderPreference"
          defaultValue={defaults.reminderPreference}
          invalid={Boolean(err?.reminderPreference)}
        >
          <option value="EMAIL">Email me before a visit</option>
          <option value="NONE">Do not remind me</option>
        </Select>
      </Field>

      <SubmitButton>Save contact details</SubmitButton>
    </form>
  );
}
