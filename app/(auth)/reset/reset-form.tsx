"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function ResetForm({ code = "" }: { code?: string }) {
  const [state, action] = useActionState(resetPassword, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message} />

      {/* Shown rather than hidden, so the code from the email can be typed in
          by somebody whose mail client mangled the link. */}
      <Field label="Reset code" htmlFor="code" error={err?.code} required>
        <TextInput
          id="code"
          name="code"
          defaultValue={code}
          required
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className="tabular"
          invalid={Boolean(err?.code)}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="password"
        error={err?.password}
        hint="At least 10 characters."
        required
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(err?.password)}
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirmPassword" error={err?.confirmPassword} required>
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(err?.confirmPassword)}
        />
      </Field>

      <SubmitButton pendingLabel="Setting…" className="w-full">
        Set the new password
      </SubmitButton>
    </form>
  );
}
