"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

const CONTROL =
  // 16px text: the guideline body size, and the size below which iOS zooms
  // into a focused field.
  "w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-base leading-6 text-ink " +
  "placeholder:text-ink-faint transition-colors hover:border-accent/50 " +
  "focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const message = error?.[0];
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm leading-5 font-semibold">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {message ? (
        <p className="mt-1.5 text-sm text-danger-ink">{message}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  invalid,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${invalid ? "border-danger" : ""} ${className}`}
    />
  );
}

export function TextArea({
  invalid,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} resize-y leading-relaxed ${invalid ? "border-danger" : ""} ${className}`}
    />
  );
}

export function Select({
  invalid,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} appearance-none bg-[length:0] pr-8 ${invalid ? "border-danger" : ""} ${className}`}
    >
      {children}
    </select>
  );
}

/** Disables itself while the enclosing form's action is in flight. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  /** Set on a form with more than one submit, to say which one was pressed. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClass(variant, className)}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink"
    >
      {message}
    </p>
  );
}

/** Grid wrapper used by every form so field rhythm stays identical. */
export function FieldGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-5 sm:grid-cols-2 ${className}`}>{children}</div>;
}
