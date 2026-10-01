"use client";

import { useActionState } from "react";
import { grantCareAction } from "@/app/actions/portal";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

/** "Let someone look after my records": their Medfave login's email. */
export function CareForm() {
  const [state, action] = useActionState(grantCareAction, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-3">
      {state.ok ? <p className="text-sm text-ok-ink">{state.message}</p> : <FormError message={state.message} />}
      <Field label="Their email" htmlFor="care-email" error={state.fieldErrors?.email} hint="The email they sign in to Medfave with.">
        <TextInput id="care-email" name="email" type="email" autoComplete="off" placeholder="ana@example.com" invalid={Boolean(state.fieldErrors?.email)} />
      </Field>
      <SubmitButton pendingLabel="Adding…">Let them look after me</SubmitButton>
    </form>
  );
}
