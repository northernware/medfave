"use client";

import { useActionState } from "react";
import { resendVerification } from "@/app/actions/sign-up";
import { SubmitButton } from "@/components/form";
import { EMPTY_FORM_STATE } from "@/lib/validation";

export function ResendVerification() {
  const [state, action] = useActionState(resendVerification, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-2">
      {state.message ? (
        <p role="status" className={state.ok ? "text-sm text-ok-ink" : "text-sm text-danger-ink"}>
          {state.message}
        </p>
      ) : null}
      <SubmitButton variant="secondary" pendingLabel="Sending…">
        Send the link again
      </SubmitButton>
    </form>
  );
}
