"use client";

import { useActionState } from "react";
import { Field, FieldGrid, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export function ClinicDetailsForm({
  action,
  defaults,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: { name: string; address: string; contactNumber: string };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message} />

      <Field
        label="Clinic name"
        htmlFor="name"
        error={err?.name}
        hint="Heads every prescription and certificate, and names the clinic in its emails."
        required
      >
        <TextInput
          id="name"
          name="name"
          defaultValue={defaults.name}
          required
          invalid={Boolean(err?.name)}
        />
      </Field>

      <Field label="Address" htmlFor="address" error={err?.address} hint="Printed under the name.">
        <TextInput
          id="address"
          name="address"
          defaultValue={defaults.address}
          placeholder="Street, barangay, city"
          invalid={Boolean(err?.address)}
        />
      </Field>

      <FieldGrid>
        <Field
          label="Telephone"
          htmlFor="contactNumber"
          error={err?.contactNumber}
          hint="Printed on the letterhead."
        >
          <TextInput
            id="contactNumber"
            name="contactNumber"
            type="tel"
            defaultValue={defaults.contactNumber}
            placeholder="(074) 000 0000"
            invalid={Boolean(err?.contactNumber)}
          />
        </Field>
      </FieldGrid>

      <SubmitButton>Save clinic details</SubmitButton>
    </form>
  );
}
