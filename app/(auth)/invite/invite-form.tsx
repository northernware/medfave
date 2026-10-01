"use client";

import { useActionState } from "react";
import { acceptStaffInvite } from "@/app/actions/auth";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { NameFields } from "@/components/name-fields";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function InviteForm({ code = "" }: { code?: string }) {
  const [state, action] = useActionState(acceptStaffInvite, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message} />

      <Field label="Invitation code" htmlFor="code" error={err?.code} required>
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

      <NameFields error={err?.fullName} />

      {/* The address is not asked for: it is the one the invitation was sent
          to, and letting it be typed here would make the invitation a blank
          pass for whoever holds the code. */}
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

      <SubmitButton className="w-full">Join the clinic</SubmitButton>
    </form>
  );
}
