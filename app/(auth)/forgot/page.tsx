import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgotten password" };

export default function ForgotPage() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Forgotten password</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the address you sign in with and we will send a link for setting a new password.
      </p>

      <ForgotForm />

      <p className="mt-6 text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-accent-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
