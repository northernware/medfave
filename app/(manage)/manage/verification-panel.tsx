"use client";

import { useActionState } from "react";
import { sendForCheckAgain } from "@/app/actions/practice";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

/** A declined doctor's details, to correct and send again. */
export function ResubmitForm({
  doctor,
}: {
  doctor: {
    fullName: string;
    licenseNumber: string | null;
    specialty: string | null;
  };
}) {
  const [state, action] = useActionState(sendForCheckAgain, EMPTY_FORM_STATE);
  const err = state.fieldErrors;
  const v = state.values ?? {};
  if (state.ok)
    return (
      <p role="status" className="text-sm text-ok-ink">
        {state.message}
      </p>
    );

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.message} />
      <Field label="Name on your PRC licence" htmlFor="licenceName" error={err?.licenceName} required>
        <TextInput
          id="licenceName"
          name="licenceName"
          defaultValue={v.licenceName ?? doctor.fullName}
          required
          invalid={Boolean(err?.licenceName)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="PRC licence number"
          htmlFor="licenseNumber"
          error={err?.licenseNumber}
          hint="Seven digits, as on your PRC ID."
          required
        >
          <TextInput
            id="licenseNumber"
            name="licenseNumber"
            inputMode="numeric"
            defaultValue={v.licenseNumber ?? doctor.licenseNumber ?? ""}
            required
            invalid={Boolean(err?.licenseNumber)}
          />
        </Field>
        <Field label="Specialty" htmlFor="specialty" error={err?.specialty}>
          <TextInput
            id="specialty"
            name="specialty"
            defaultValue={v.specialty ?? doctor.specialty ?? ""}
            invalid={Boolean(err?.specialty)}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Sending…" className="w-full sm:w-auto">
        Send for checking again
      </SubmitButton>
    </form>
  );
}
