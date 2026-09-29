import type { Metadata } from "next";
import Link from "next/link";
import { FormError } from "@/components/form";
import { GoogleButton, OrDivider } from "@/components/google-button";
import { googleConfigured } from "@/lib/google";
import { LoginForm } from "./login-form";

/** Why "Continue with Google" came back here. Cancelling needs no message. */
const GOOGLE_ERRORS: Record<string, string> = {
  unverified: "Google hasn't confirmed that email address, so we can't use it to sign you in. Use email and password instead.",
  failed: "Signing in with Google didn't work. Try again.",
  unavailable: "Signing in with Google isn't available right now. Use email and password instead.",
};

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reset, google } = await searchParams;
  const googleError = typeof google === "string" ? GOOGLE_ERRORS[google] : undefined;

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

      {googleError ? (
        <div className="mt-4">
          <FormError message={googleError} />
        </div>
      ) : null}

      {googleConfigured() ? (
        <div className="mt-6">
          <GoogleButton />
          <OrDivider />
        </div>
      ) : null}

      <LoginForm />

      <p className="mt-4 text-sm text-ink-muted">
        <Link href="/forgot" className="font-medium text-accent-ink hover:underline">
          Forgotten your password?
        </Link>
      </p>

      <p className="mt-6 text-sm text-ink-muted">
        New to Medfave?{" "}
        <Link href="/signup" className="font-medium text-accent-ink hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Patient with an activation code?{" "}
        <Link href="/register" className="font-medium text-accent-ink hover:underline">
          Activate your account
        </Link>
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Secretaries and clinic staff join by invitation from their clinic.
      </p>
    </div>
  );
}
