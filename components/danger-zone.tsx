"use client";

import { useRef } from "react";
import { DangerTriangleIcon } from "@solar-icons/react/linear/danger-triangle";
import { buttonClass } from "./ui";
import { TypedConfirm } from "./typed-confirm";

/**
 * A destructive (or at least serious) action, set apart as its own row: what
 * it does, and a button that opens a dialog to confirm it. The dialog carries
 * the warning and, for a permanent deletion, the phrase to type. Nothing here
 * is tinted; red is kept for the buttons that mean it.
 */
export function DangerZone({
  action,
  fieldName,
  fieldValue,
  summary,
  warning,
  confirmLabel,
  variant = "danger",
  confirmPhrase,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  fieldName: string;
  fieldValue: string;
  summary: string;
  warning: string;
  confirmLabel: string;
  /** Archiving is reversible, so it does not have to look like deletion. */
  variant?: "danger" | "secondary";
  /** A permanent deletion: the button waits for this to be typed (and the action checks it again). */
  confirmPhrase?: string;
  /** Extra fields the action needs — a reason, most often. */
  children?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const loud = variant === "danger";
  const cancel = (
    <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("ghost")}>
      Cancel
    </button>
  );

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface px-5 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-sm font-semibold">{summary}</h2>
        <p className="mt-0.5 text-sm text-pretty text-ink-muted">{warning}</p>
      </div>
      <button type="button" onClick={() => dialog.current?.showModal()} className={buttonClass(variant)}>
        {confirmLabel}…
      </button>

      <dialog
        ref={dialog}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-ink shadow-lg backdrop:bg-black/45"
      >
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name={fieldName} value={fieldValue} />
          <div className="flex items-start gap-3">
            {loud ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger-soft text-danger-ink">
                <DangerTriangleIcon aria-hidden className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{summary}?</h2>
              <p className="mt-1 text-sm text-pretty text-ink-muted">{warning}</p>
            </div>
          </div>
          {children}
          {confirmPhrase ? (
            <TypedConfirm phrase={confirmPhrase} confirmLabel={confirmLabel} variant={loud ? "dangerSolid" : "secondary"}>
              {cancel}
            </TypedConfirm>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button className={buttonClass(loud ? "dangerSolid" : "secondary")}>{confirmLabel}</button>
              {cancel}
            </div>
          )}
        </form>
      </dialog>
    </section>
  );
}
