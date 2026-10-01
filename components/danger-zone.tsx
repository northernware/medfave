import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { buttonClass } from "./ui";

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
  /** Extra fields the action needs — a reason, most often. */
  children?: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-ink-muted transition-colors hover:text-danger-ink">
        {summary}
        <AltArrowRightIcon aria-hidden className="ml-1 inline-block size-4 align-[-3px] transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-border px-5 py-4">
        <p className="text-sm text-pretty text-ink-muted">{warning}</p>
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name={fieldName} value={fieldValue} />
          {children}
          <button className={buttonClass(variant)}>{confirmLabel}</button>
        </form>
      </div>
    </details>
  );
}
