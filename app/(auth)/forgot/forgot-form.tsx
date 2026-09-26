"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, EMPTY_FORM_STATE);

  // Once the request is in, the form is gone: leaving it on screen invites a
  // second submission, which would revoke the link the first one just sent.
  if (state.ok) {
    return (
      <p
        role="status"
        className="mt-6 rounded-lg border border-ok/40 bg-ok-tint px-3 py-2 text-sm text-ok-ink"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message} />

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@clinic.ph"
          invalid={Boolean(state.fieldErrors?.email)}
        />
      </Field>

      <SubmitButton pendingLabel="Sending…" className="w-full">
        Send a reset link
      </SubmitButton>
    </form>
  );
}
