import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton, OrDivider } from "@/components/google-button";
import { googleConfigured } from "@/lib/google";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { as } = await searchParams;

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        For patients and for doctors. Your account alone shows no medical records — a clinic links you to yours.
      </p>

      {googleConfigured() ? (
        <div className="mt-6">
          <GoogleButton as={as === "doctor" ? "doctor" : undefined} />
          <OrDivider />
        </div>
      ) : null}

      <SignUpForm role={as === "doctor" ? "DOCTOR" : "PATIENT"} />

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-ink hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Have an activation code from your clinic?{" "}
        <Link href="/register" className="font-medium text-accent-ink hover:underline">
          Activate with it
        </Link>
      </p>
    </div>
  );
}
