import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { DangerTriangleIcon } from "@solar-icons/react/linear/danger-triangle";
import { buttonClass } from "./ui";
import { TypedConfirm } from "./typed-confirm";

/**
 * Destructive actions sit behind a disclosure rather than a JS confirm, so the
 * warning is readable and the whole thing still works without JavaScript.
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
  // A permanent deletion looks like one; an archive, which can be undone, stays quiet.
  const loud = variant === "danger";
  return (
    <details className={`group rounded-xl border ${loud ? "border-danger/40 bg-danger-tint" : "border-border bg-surface"}`}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
          loud ? "text-danger-ink" : "text-ink-muted hover:text-danger-ink"
        }`}
      >
        {loud ? <DangerTriangleIcon aria-hidden className="size-4 shrink-0" /> : null}
        {summary}
        <AltArrowRightIcon aria-hidden className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className={`border-t px-5 py-4 ${loud ? "border-danger/30" : "border-border"}`}>
        <p className="text-sm text-pretty text-ink-muted">{warning}</p>
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name={fieldName} value={fieldValue} />
          {children}
          {confirmPhrase ? (
            <TypedConfirm phrase={confirmPhrase} confirmLabel={confirmLabel} variant={variant} />
          ) : (
            <button className={buttonClass(variant)}>{confirmLabel}</button>
          )}
        </form>
      </div>
    </details>
  );
}
