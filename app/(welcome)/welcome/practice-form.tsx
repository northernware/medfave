"use client";

import { useActionState } from "react";
import { setUpPractice } from "@/app/actions/practice";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

/** A doctor's own practice: who they are to the PRC, then the clinic. */
export function PracticeForm({ name }: { name: string }) {
  const [state, action] = useActionState(setUpPractice, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={action} className="space-y-5 px-5 pb-5">
      <FormError message={state.message} />

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold tracking-wide text-ink-faint uppercase">You</legend>
        <Field label="Name on your PRC licence" htmlFor="licenceName" error={err?.licenceName} required>
          <TextInput id="licenceName" name="licenceName" defaultValue={name} autoComplete="name" required invalid={Boolean(err?.licenceName)} />
        </Field>
        <Field label="PRC licence number" htmlFor="licenseNumber" error={err?.licenseNumber} hint="Seven digits, as on your PRC ID." required>
          <TextInput id="licenseNumber" name="licenseNumber" inputMode="numeric" required invalid={Boolean(err?.licenseNumber)} />
        </Field>
        <Field label="Specialty" htmlFor="specialty" error={err?.specialty} hint="For example, Family Medicine. Optional.">
          <TextInput id="specialty" name="specialty" invalid={Boolean(err?.specialty)} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold tracking-wide text-ink-faint uppercase">Your clinic</legend>
        <Field label="Clinic name" htmlFor="clinicName" error={err?.clinicName} required>
          <TextInput id="clinicName" name="clinicName" required invalid={Boolean(err?.clinicName)} />
        </Field>
        <Field label="Address" htmlFor="address" error={err?.address} required>
          <TextInput id="address" name="address" autoComplete="street-address" required invalid={Boolean(err?.address)} />
        </Field>
        <Field label="Phone" htmlFor="contactNumber" error={err?.contactNumber} hint="The number patients call." required>
          <TextInput id="contactNumber" name="contactNumber" type="tel" autoComplete="tel" required invalid={Boolean(err?.contactNumber)} />
        </Field>
      </fieldset>

      <p className="text-sm text-ink-muted">
        Your clinic starts open Monday to Friday 9–5 and Saturday 9–12, with lunch from 12 to 1. You can change all of
        it next.
      </p>

      <SubmitButton pendingLabel="Setting up…" className="w-full">
        Set up my clinic
      </SubmitButton>
    </form>
  );
}
