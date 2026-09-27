"use client";

import { buttonClass } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Something went wrong</h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          Nothing was saved. Try again, and if it keeps happening check the server logs.
        </p>
        {/*
          React replaces a server error's message with a generic one before it
          reaches the browser, so the cause cannot be shown here. The digest is
          the one thing that survives, and the server logs the real error under
          the same value — quoting it turns "check the server logs" into a line
          the reader can actually search for.
        */}
        {error.digest ? (
          <p className="nums mt-4 text-xs text-ink-faint">
            Error ID <span className="text-ink-muted">{error.digest}</span>
          </p>
        ) : null}
        <button onClick={reset} className={buttonClass("primary", "mt-6")}>
          Try again
        </button>
      </div>
    </div>
  );
}
