/**
 * Where a new clinic stands: set up, license being checked, open. The middle
 * step turns red when the check was declined, so the doctor sees at a glance
 * which part needs them.
 */
export function VerificationTracker({ status }: { status: "PENDING" | "DECLINED" | "VERIFIED" }) {
  const steps = [
    { label: "Clinic set up", state: "done" },
    {
      label: status === "DECLINED" ? "License needs a fix" : "License check",
      state: status === "VERIFIED" ? "done" : status === "DECLINED" ? "problem" : "current",
    },
    { label: "Clinic opens", state: status === "VERIFIED" ? "done" : "todo" },
  ] as const;

  return (
    <ol className="flex items-start gap-2" aria-label="Setup progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex flex-1 flex-col gap-2">
          <span
            aria-hidden="true"
            className={[
              "h-1.5 rounded-full",
              step.state === "done"
                ? "bg-ok"
                : step.state === "current"
                  ? "bg-warn"
                  : step.state === "problem"
                    ? "bg-danger"
                    : "bg-surface-muted",
            ].join(" ")}
          />
          <span className="flex items-center gap-1.5 text-xs leading-4 font-medium sm:text-sm">
            <span
              aria-hidden="true"
              className={[
                "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                step.state === "done"
                  ? "bg-ok text-white"
                  : step.state === "current"
                    ? "bg-warn-tint text-warn-ink ring-1 ring-warn"
                    : step.state === "problem"
                      ? "bg-danger text-white"
                      : "bg-surface-muted text-ink-faint",
              ].join(" ")}
            >
              {step.state === "done" ? "✓" : step.state === "problem" ? "!" : i + 1}
            </span>
            <span className={step.state === "todo" ? "text-ink-faint" : ""}>
              {step.label}
              <span className="sr-only">
                {step.state === "done"
                  ? " (done)"
                  : step.state === "current"
                    ? " (in progress)"
                    : step.state === "problem"
                      ? " (needs you)"
                      : ""}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
