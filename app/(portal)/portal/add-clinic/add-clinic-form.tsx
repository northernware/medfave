"use client";

import { useActionState } from "react";
import { addClinic } from "@/app/actions/portal";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function AddClinicForm({ code = "" }: { code?: string }) {
  const [state, action] = useActionState(addClinic, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-4 p-5">
      <FormError message={state.message} />
      <Field label="Activation code" htmlFor="code" error={state.fieldErrors?.code} required>
        <TextInput
          id="code"
          name="code"
          defaultValue={code}
          required
          placeholder="6-digit code"
          className="tabular"
          invalid={Boolean(state.fieldErrors?.code)}
        />
      </Field>
      <SubmitButton pendingLabel="Adding…">Add clinic</SubmitButton>
    </form>
  );
}
