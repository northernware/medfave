"use client";

import { useActionState } from "react";
import { activatePatientAccount } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function RegisterForm({ code = "" }: { code?: string }) {
  const [state, action] = useActionState(activatePatientAccount, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message} />

      <Field
        label="Activation code"
        htmlFor="code"
        error={err?.code}
        hint="Given to you by the clinic. It is what ties this login to your records."
        required
      >
        <TextInput
          id="code"
          name="code"
          defaultValue={code}
          required
          placeholder="6-digit code"
          className="tabular"
          invalid={Boolean(err?.code)}
        />
      </Field>

      <Field label="Full name" htmlFor="fullName" error={err?.fullName} required>
        <TextInput
          id="fullName"
          name="fullName"
          required
          placeholder="Ramon Dela Cruz"
          invalid={Boolean(err?.fullName)}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={err?.email} required>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
          invalid={Boolean(err?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={err?.password} hint="At least 10 characters." required>
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

      <SubmitButton className="w-full">Activate my account</SubmitButton>
    </form>
  );
}
