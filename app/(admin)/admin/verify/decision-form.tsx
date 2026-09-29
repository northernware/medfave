"use client";

import { useActionState, useState } from "react";
import { decideDoctor } from "@/app/actions/practice";
import { Field, FormError, SubmitButton, TextArea } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { EMPTY_FORM_STATE } from "@/lib/validation";

/** Verify, or decline with a reason the doctor will read. */
export function DecisionForm({ doctorId }: { doctorId: string }) {
  const [state, action] = useActionState(decideDoctor, EMPTY_FORM_STATE);
  const [declining, setDeclining] = useState(false);
  if (state.ok) return <p role="status" className="text-sm text-ok-ink">{state.message}</p>;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="doctorId" value={doctorId} />
      <FormError message={state.message} />
      {declining ? (
        <>
          <Field label="Why? The doctor reads this." htmlFor={`reason-${doctorId}`} error={state.fieldErrors?.reason} required>
            <TextArea id={`reason-${doctorId}`} name="reason" rows={2} placeholder="e.g. The licence number doesn't match that name in the PRC lookup." />
          </Field>
          <div className="flex gap-2">
            <SubmitButton name="decision" value="decline" variant="danger" pendingLabel="Declining…">
              Decline
            </SubmitButton>
            <button type="button" className={buttonClass("ghost")} onClick={() => setDeclining(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <SubmitButton name="decision" value="verify" pendingLabel="Verifying…">
            Verify
          </SubmitButton>
          <button type="button" className={buttonClass("secondary")} onClick={() => setDeclining(true)}>
            Decline…
          </button>
        </div>
      )}
    </form>
  );
}
