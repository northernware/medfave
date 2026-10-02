"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

/**
 * Asks for a phrase to be typed before a destructive button works. The button
 * stays disabled until it matches; the action checks the phrase again on the
 * server, so this is a guard against slips, not the only one.
 */
export function TypedConfirm({
  phrase,
  confirmLabel,
  cancel,
}: {
  phrase: string;
  confirmLabel: string;
  /** The way out, placed first. */
  cancel: React.ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLowerCase() === phrase;
  return (
    <>
      <div className="px-6 pb-5">
        <label htmlFor="confirmation" className="block text-sm text-ink-muted">
          To confirm, type{" "}
          <strong className="font-semibold text-ink select-all">{phrase}</strong>
        </label>
        <input
          id="confirmation"
          name="confirmation"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="confirmation-hint"
          className="mt-2 w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm focus:border-danger focus:ring-4 focus:ring-danger/10 focus:outline-none"
        />
        <p id="confirmation-hint" className="mt-1.5 text-xs text-ink-faint">
          {ready ? "That matches." : "Capitals and spaces don't matter."}
        </p>
      </div>
      <Footer cancel={cancel} confirmLabel={confirmLabel} disabled={!ready} />
    </>
  );
}

/** The dialog's foot: the way out first, the deed last. */
export function Footer({
  cancel,
  confirmLabel,
  disabled = false,
  variant = "dangerSolid",
}: {
  cancel: React.ReactNode;
  confirmLabel: string;
  disabled?: boolean;
  variant?: "dangerSolid" | "primary";
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-muted px-6 py-4">
      {cancel}
      <button disabled={disabled} className={buttonClass(variant, "disabled:opacity-45")}>
        {confirmLabel}
      </button>
    </div>
  );
}
