"use client";

import { useRef, useState } from "react";

const LENGTH = 6;

/**
 * The clinic's 6-digit activation code, typed like a one-time PIN: six boxes
 * that move along as you type, take a pasted code whole, and accept the
 * phone's code autofill. Posts as one `name` field.
 *
 * A long code from a QR, link or email arrives filled in; that isn't six
 * digits, so it shows as a plain field, with a way back to the boxes.
 */
export function CodeInput({
  name = "code",
  defaultValue = "",
  invalid = false,
  id,
}: {
  name?: string;
  defaultValue?: string;
  invalid?: boolean;
  id?: string;
}) {
  const [long, setLong] = useState(defaultValue && !/^\d{0,6}$/.test(defaultValue) ? defaultValue : "");
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: LENGTH }, (_, i) => (/^\d{0,6}$/.test(defaultValue) ? (defaultValue[i] ?? "") : "")),
  );
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  if (long) {
    return (
      <div className="space-y-1.5">
        <input
          id={id}
          name={name}
          value={long}
          onChange={(e) => setLong(e.target.value)}
          className="tabular w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-base text-ink focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none"
        />
        <button type="button" onClick={() => setLong("")} className="text-sm text-ink-muted hover:text-ink hover:underline">
          Use a 6-digit code instead
        </button>
      </div>
    );
  }

  function fill(from: number, text: string) {
    const incoming = text.replace(/\D/g, "").slice(0, LENGTH - from).split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    incoming.forEach((d, k) => (next[from + k] = d));
    setDigits(next);
    boxes.current[Math.min(from + incoming.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex gap-1.5 sm:gap-2" role="group" aria-label="6-digit code">
      <input type="hidden" name={name} value={digits.join("")} />
      {digits.map((d, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={LENGTH}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) {
              const next = [...digits];
              next[i] = "";
              setDigits(next);
            } else fill(i, v); // the box selects itself on focus, so typing replaces; longer is a paste or autofill
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < LENGTH - 1) boxes.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fill(i, e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
          className={[
            "tabular h-14 w-11 rounded-md sm:w-12 border bg-surface text-center font-display text-2xl font-semibold text-ink",
            "focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none",
            invalid ? "border-danger" : "border-border-strong",
            i === 2 ? "mr-1.5 sm:mr-2" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
