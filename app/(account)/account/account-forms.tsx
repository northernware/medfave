"use client";

import { useActionState } from "react";
import { Field, FieldGrid, FormError, SubmitButton, TextInput } from "@/components/form";
import { NameFields } from "@/components/name-fields";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function AccountDetailsForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: { fullName: string; email: string; firstName: string | null; middleName: string | null; lastName: string | null };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message} />

      <NameFields error={err?.fullName} defaults={defaults} />

      <FieldGrid>
        <Field
          label="Email"
          htmlFor="email"
          error={err?.email}
          hint="You sign in with this."
          required
        >
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={defaults.email}
            required
            invalid={Boolean(err?.email)}
          />
        </Field>
      </FieldGrid>

      <SubmitButton>Save details</SubmitButton>
    </form>
  );
}

export function ClinicianProfileForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: { specialty: string; licenseNumber: string };
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message} />

      <FieldGrid>
        <Field label="Specialty" htmlFor="specialty" error={err?.specialty}>
          <TextInput
            id="specialty"
            name="specialty"
            defaultValue={defaults.specialty}
            placeholder="Family Medicine"
            invalid={Boolean(err?.specialty)}
          />
        </Field>
        <Field
          label="PRC license number"
          htmlFor="licenseNumber"
          error={err?.licenseNumber}
          hint="Printed beneath your signature."
        >
          <TextInput
            id="licenseNumber"
            name="licenseNumber"
            defaultValue={defaults.licenseNumber}
            placeholder="PRC-0114532"
            invalid={Boolean(err?.licenseNumber)}
          />
        </Field>
      </FieldGrid>

      <SubmitButton>Save clinician details</SubmitButton>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.message} />

      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={err?.currentPassword}
        hint="Asked for so that an unlocked screen is not enough to take the account over."
        required
      >
        <TextInput
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(err?.currentPassword)}
        />
      </Field>

      <FieldGrid>
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
        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={err?.confirmPassword}
          required
        >
          <TextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            invalid={Boolean(err?.confirmPassword)}
          />
        </Field>
      </FieldGrid>

      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
