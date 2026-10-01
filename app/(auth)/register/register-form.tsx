"use client";

import { useActionState, useState } from "react";
import { activatePatientAccount, previewActivationCode } from "@/app/actions/auth";
import { ActivationConfirm } from "@/components/activation-confirm";
import { buttonClass } from "@/components/ui";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { NameFields } from "@/components/name-fields";
import { CodeInput } from "@/components/code-input";
import type { ActivationPreview } from "@/lib/sign-in";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

const NOTHING_SHOWN: FormState & { preview?: ActivationPreview } = EMPTY_FORM_STATE;

/**
 * Three steps: the code; whose record it opens ("This is me"); then the login.
 * The record is confirmed before an account exists, so a code for somebody
 * else is caught before it's tied to anyone.
 */
export function RegisterForm({ code = "" }: { code?: string }) {
  const [shown, preview] = useActionState(previewActivationCode, NOTHING_SHOWN);
  const [state, action] = useActionState(activatePatientAccount, EMPTY_FORM_STATE);
  // Which lookup was answered: "this is me" (go on) or cancelled (back to the code).
  const [answer, setAnswer] = useState<{ to: object; mine: boolean } | null>(null);
  const err = state.fieldErrors;
  const p = shown.preview && answer?.to === shown && !answer.mine ? undefined : shown.preview;

  if (!p) {
    return (
      <form action={preview} className="mt-6 space-y-4">
        <FormError message={shown.message} />
        <Field
          label="Activation code"
          htmlFor="code"
          error={shown.fieldErrors?.code}
          hint="Given to you by the clinic. It is what ties this login to your records."
          required
        >
          <CodeInput id="code" defaultValue={code} invalid={Boolean(shown.fieldErrors?.code)} />
        </Field>
        <SubmitButton className="w-full" pendingLabel="Checking…">
          Continue
        </SubmitButton>
      </form>
    );
  }

  if (answer?.to !== shown) {
    return (
      <div className="mt-6 space-y-4">
        <ActivationConfirm preview={p} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("primary")} onClick={() => setAnswer({ to: shown, mine: true })}>
            {p.forCaregiver ? "Yes, I look after them" : "This is me"}
          </button>
          <button type="button" className={buttonClass("secondary")} onClick={() => setAnswer({ to: shown, mine: false })}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message ?? err?.code?.[0]} />
      <input type="hidden" name="code" value={p.code} />
      <input type="hidden" name="confirmedPatientId" value={p.patientId} />
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-ink-muted">
        {p.forCaregiver ? "Your login, to look after " : "Activating for "}
        <strong className="text-ink">{p.name}</strong> at {p.clinicName}.
        {p.emailOnFile && !p.forCaregiver ? <> The clinic has {p.emailOnFile} on file.</> : null}
      </p>

      <NameFields error={err?.fullName} />

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
