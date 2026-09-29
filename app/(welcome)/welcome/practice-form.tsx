"use client";

import { useActionState, useRef, useState } from "react";
import { setUpPractice } from "@/app/actions/practice";
import { Field, FormError, SubmitButton, TextInput } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/validation";

const STEPS = ["You", "Your clinic"] as const;
const FIRST_STEP_FIELDS = ["licenceName", "licenseNumber", "specialty"];

/**
 * A doctor's own practice: who they are to the PRC, then the clinic. On a
 * phone-sized screen it goes one step at a time; wider, it is one form.
 */
export function PracticeForm({ name }: { name: string }) {
  const [state, action] = useActionState(setUpPractice, EMPTY_FORM_STATE);
  const err = state.fieldErrors;
  const v = state.values ?? {};
  const [step, setStep] = useState(0);
  const first = useRef<HTMLFieldSetElement>(null);

  // After the server refuses, open the step with the first problem on it.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (err) setStep(FIRST_STEP_FIELDS.some((k) => err[k]) ? 0 : 1);
  }

  function next() {
    const inputs = [...(first.current?.querySelectorAll("input") ?? [])];
    if (inputs.every((i) => i.reportValidity())) setStep(1);
  }

  // Narrow screens show only the current step; from `sm` up, everything.
  const shown = (i: number) => (step === i ? "" : "hidden sm:block");

  return (
    <form action={action} className="space-y-5 px-5 pb-5">
      <FormError message={state.message} />

      <div className="sm:hidden">
        <p className="text-sm text-ink-muted">
          Step {step + 1} of {STEPS.length} · <span className="font-semibold text-ink">{STEPS[step]}</span>
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {STEPS.map((label, i) => (
            <span key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-muted"}`} />
          ))}
        </div>
      </div>

      <fieldset ref={first} className={`space-y-4 ${shown(0)}`}>
        <legend className="sr-only text-sm font-semibold tracking-wide text-ink-faint uppercase sm:not-sr-only">You</legend>
        <Field label="Name on your PRC licence" htmlFor="licenceName" error={err?.licenceName} required>
          <TextInput id="licenceName" name="licenceName" defaultValue={v.licenceName ?? name} autoComplete="name" required invalid={Boolean(err?.licenceName)} />
        </Field>
        <Field label="PRC licence number" htmlFor="licenseNumber" error={err?.licenseNumber} hint="Seven digits, as on your PRC ID." required>
          <TextInput id="licenseNumber" name="licenseNumber" defaultValue={v.licenseNumber} inputMode="numeric" required invalid={Boolean(err?.licenseNumber)} />
        </Field>
        <Field label="Specialty" htmlFor="specialty" error={err?.specialty} hint="For example, Family Medicine. Optional.">
          <TextInput id="specialty" name="specialty" defaultValue={v.specialty} invalid={Boolean(err?.specialty)} />
        </Field>
      </fieldset>

      <fieldset className={`space-y-4 ${shown(1)}`}>
        <legend className="sr-only text-sm font-semibold tracking-wide text-ink-faint uppercase sm:not-sr-only">Your clinic</legend>
        <Field label="Clinic name" htmlFor="clinicName" error={err?.clinicName} required>
          <TextInput id="clinicName" name="clinicName" defaultValue={v.clinicName} required invalid={Boolean(err?.clinicName)} />
        </Field>
        <Field label="Address" htmlFor="address" error={err?.address} required>
          <TextInput id="address" name="address" defaultValue={v.address} autoComplete="street-address" required invalid={Boolean(err?.address)} />
        </Field>
        <Field label="Phone" htmlFor="contactNumber" error={err?.contactNumber} hint="The number patients call." required>
          <TextInput id="contactNumber" name="contactNumber" defaultValue={v.contactNumber} type="tel" autoComplete="tel" required invalid={Boolean(err?.contactNumber)} />
        </Field>
      </fieldset>

      <p className={`text-sm text-ink-muted ${shown(1)}`}>
        Your clinic starts open Monday to Friday 9–5 and Saturday 9–12, with lunch from 12 to 1. You can change all of
        it next.
      </p>

      {step === 0 ? (
        <button type="button" onClick={next} className={buttonClass("primary", "w-full sm:hidden")}>
          Next: your clinic
        </button>
      ) : null}
      <div className={`gap-2 ${step === 1 ? "flex" : "hidden sm:flex"}`}>
        <button type="button" onClick={() => setStep(0)} className={buttonClass("secondary", "sm:hidden")}>
          Back
        </button>
        <SubmitButton pendingLabel="Setting up…" className="flex-1">
          Set up my clinic
        </SubmitButton>
      </div>
    </form>
  );
}
