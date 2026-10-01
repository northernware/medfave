"use client";

import { useActionState } from "react";
import { addClinic } from "@/app/actions/portal";
import { Field, FormError, SubmitButton } from "@/components/form";
import { CodeInput } from "@/components/code-input";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function AddClinicForm({ code = "" }: { code?: string }) {
  const [state, action] = useActionState(addClinic, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-4 p-5">
      <FormError message={state.message} />
      <Field label="Activation code" htmlFor="code" error={state.fieldErrors?.code} required>
        <CodeInput id="code" defaultValue={code} invalid={Boolean(state.fieldErrors?.code)} />
      </Field>
      <SubmitButton pendingLabel="Adding…">Add clinic</SubmitButton>
    </form>
  );
}
