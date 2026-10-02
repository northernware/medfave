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
  variant,
}: {
  phrase: string;
  confirmLabel: string;
  variant: "danger" | "secondary";
}) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLowerCase() === phrase;
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-ink-muted">
          Type <strong className="font-semibold text-ink select-all">{phrase}</strong> to confirm.
        </span>
        <input
          name="confirmation"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={phrase}
          className="w-full max-w-sm rounded-md border border-danger/40 bg-surface px-3 py-2 text-sm placeholder:text-ink-faint focus:border-danger"
        />
      </label>
      <button disabled={!ready} className={`${buttonClass(variant)} disabled:cursor-not-allowed disabled:opacity-50`}>
        {confirmLabel}
      </button>
    </div>
  );
}
