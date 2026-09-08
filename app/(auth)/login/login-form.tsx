"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function LoginForm() {
  const [state, action] = useActionState(login, EMPTY_FORM_STATE);

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

      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password} required>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
