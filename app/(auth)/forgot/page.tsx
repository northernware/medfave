import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgotten password" };

export default function ForgotPage() {
  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Forgotten password</h1>
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
