import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reset } = await searchParams;

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Sign in</h1>
      <p className="mt-2 text-base leading-6 text-ink-muted">Welcome back. Your patient list is waiting.</p>

      {reset === "done" ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-ok/40 bg-ok-tint px-3 py-2 text-sm text-ok-ink"
        >
          Your password has been changed. Sign in with the new one.
        </p>
      ) : null}

      <LoginForm />

      <p className="mt-4 text-sm text-ink-muted">
        <Link href="/forgot" className="font-medium text-accent-ink hover:underline">
          Forgotten your password?
        </Link>
      </p>

      <p className="mt-6 text-sm text-ink-muted">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-accent-ink hover:underline">
          Register your practice
        </Link>
      </p>
    </div>
  );
}
