"use client";

import Link from "next/link";
import { useActionState } from "react";
import { finishGoogleSignUp } from "@/app/actions/sign-up";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";
import { ROLES } from "../sign-up-form";

export function GoogleSignUpForm({ name, role }: { name: string; role: "PATIENT" | "DOCTOR" }) {
  const [state, action] = useActionState(finishGoogleSignUp, EMPTY_FORM_STATE);
  const err = state.fieldErrors;

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state.message} />

      <fieldset>
        <legend className="mb-1.5 block text-sm leading-5 font-semibold">
          I&rsquo;m signing up as<span className="ml-0.5 text-danger">*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer gap-3 rounded-lg border border-border-strong bg-surface p-3.5 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent-tint"
            >
              <input type="radio" name="role" value={r.value} defaultChecked={r.value === role} className="mt-1 accent-[var(--accent)]" />
              <span>
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-sm text-ink-muted">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {err?.role ? <p className="mt-1.5 text-sm text-danger-ink">{err.role[0]}</p> : null}
      </fieldset>

      <Field label="Full name" htmlFor="fullName" error={err?.fullName} hint="As it should appear to your clinic." required>
        <TextInput id="fullName" name="fullName" autoComplete="name" defaultValue={name} required invalid={Boolean(err?.fullName)} />
      </Field>

      <div>
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--accent)]" />
          <span>
            I have read the{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-accent-ink hover:underline">
              privacy notice
            </Link>{" "}
            and agree to Medfave processing my personal and health information as it describes.
          </span>
        </label>
        {err?.consent ? <p className="mt-1.5 text-sm text-danger-ink">{err.consent[0]}</p> : null}
      </div>

      <SubmitButton pendingLabel="Creating your account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
