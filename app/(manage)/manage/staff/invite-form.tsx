"use client";

import { useActionState } from "react";
import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/form";
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
      {/* The role travels on the invitation rather than being chosen when it is
          accepted, so what is picked here is exactly what is granted. A
          clinician is deliberately not on the list: adding somebody who can
          write notes is more than a form field. */}
      <Field label="Role" htmlFor="role" error={state.fieldErrors?.role}>
        <Select id="role" name="role" defaultValue="SECRETARY">
          <option value="SECRETARY">Secretary</option>
          <option value="DOCTOR">Doctor</option>
          <option value="ADMIN">Administrator</option>
        </Select>
      </Field>
      <SubmitButton>Create invitation</SubmitButton>
    </form>
  );
}
