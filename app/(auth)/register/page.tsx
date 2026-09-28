import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Activate your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { code } = await searchParams;
  const given = typeof code === "string" ? code : "";

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Activate your account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        For patients of the clinic. Your activation code is what connects this login to your own
        records — the clinic gives it to you once they have identified you.
      </p>

      {/* Arriving from the clinic's QR code or a shared link, on a phone that
          may have the app: offer it, with the code carried across. The form
          below works either way. */}
      {given ? (
        <div className="mt-6 rounded-lg bg-accent-tint p-4">
          <p className="text-sm font-medium">Have the medfave app?</p>
          <p className="mt-0.5 text-sm text-ink-muted">Open it with your code filled in, or carry on here.</p>
          <a href={`medfave://activate?code=${encodeURIComponent(given)}`} className={buttonClass("primary", "mt-3")}>
            Open in the medfave app
          </a>
        </div>
      ) : null}

      <RegisterForm code={given} />

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-ink hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Clinic staff do not sign up here. A doctor invites you, and the invitation carries your
        role.
      </p>
    </div>
  );
}
