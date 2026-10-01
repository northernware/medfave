"use client";

import { useActionState, useState } from "react";
import { addClinic, previewAddClinic } from "@/app/actions/portal";
import { ActivationConfirm } from "@/components/activation-confirm";
import { Field, FormError, SubmitButton } from "@/components/form";
import { CodeInput } from "@/components/code-input";
import { buttonClass } from "@/components/ui";
import type { ActivationPreview } from "@/lib/sign-in";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation";

const NOTHING_SHOWN: FormState & { preview?: ActivationPreview } = EMPTY_FORM_STATE;

/** Two steps: the code shows whose chart it opens; only "This is me" links it. */
export function AddClinicForm({ code = "", email }: { code?: string; email: string }) {
  const [shown, preview] = useActionState(previewAddClinic, NOTHING_SHOWN);
  const [state, link] = useActionState(addClinic, EMPTY_FORM_STATE);
  // Cancel sets aside this lookup only; entering a code again shows a fresh one.
  const [cancelled, setCancelled] = useState<object | null>(null);
  const confirming = shown.preview && cancelled !== shown ? shown.preview : null;

  if (confirming) {
    return (
      <form action={link} className="space-y-4 p-5">
        <FormError message={state.message} />
        <input type="hidden" name="code" value={confirming.code} />
        <input type="hidden" name="confirmedPatientId" value={confirming.patientId} />
        <ActivationConfirm preview={confirming} signedInAs={email} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel="Adding…">{confirming.forCaregiver ? "Yes, I look after them" : "This is me — add clinic"}</SubmitButton>
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => setCancelled(shown)}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={preview} className="space-y-4 p-5">
      <FormError message={shown.message} />
      <Field label="Activation code" htmlFor="code" error={shown.fieldErrors?.code} required>
        <CodeInput id="code" defaultValue={code} invalid={Boolean(shown.fieldErrors?.code)} />
      </Field>
      <SubmitButton pendingLabel="Checking…">Continue</SubmitButton>
    </form>
  );
}
