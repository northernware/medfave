import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pendingGoogle } from "@/lib/google";
import { GoogleSignUpForm } from "./google-sign-up-form";

export const metadata: Metadata = { title: "Finish signing up" };

/**
 * A Google sign-in by somebody new. Google vouched for the email; what is left
 * is what only they can say: patient or doctor, and consent to the privacy
 * notice. No account exists until they send this.
 */
export default async function GoogleSignUpPage() {
  const pending = await pendingGoogle();
  if (!pending) redirect("/signup");

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Almost there</h1>
      <p className="mt-1 text-sm text-ink-muted">
        You&rsquo;re signing up with Google as <strong className="text-ink">{pending.email}</strong>. Two more things
        and your account is ready.
      </p>
      <GoogleSignUpForm name={pending.name} role={pending.as ?? "PATIENT"} />
    </div>
  );
}
