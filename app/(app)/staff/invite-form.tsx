"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

export function InviteStaffForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <FormError message={state.message} />
        <Field label="Email address" htmlFor="email" error={state.fieldErrors?.email} required>
          <TextInput
            id="email"
            name="email"
            type="email"
            required
            placeholder="desk@yourclinic.ph"
            invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>
      </div>
      {/* The role is not a field. It is fixed on the invitation, so accepting
          one cannot grant anything that was not chosen here. */}
      <input type="hidden" name="role" value="SECRETARY" />
      <SubmitButton>Create invitation</SubmitButton>
    </form>
  );
}
