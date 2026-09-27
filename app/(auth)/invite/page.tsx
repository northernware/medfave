import type { Metadata } from "next";
import Link from "next/link";
import { peekInvite } from "@/app/actions/auth";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Join a clinic" };

const ROLE_WORDS: Record<string, string> = {
  DOCTOR: "a doctor",
  SECRETARY: "a secretary",
  ADMIN: "an administrator",
};

export default async function InvitePage({ searchParams }: PageProps<"/invite">) {
  const { code } = await searchParams;
  // Read, not spent: the page can say who the invitation is for without
  // accepting it, and says nothing at all when the code is not a real one.
  const invite = typeof code === "string" && code ? await peekInvite(code) : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Join a clinic</h1>
      {invite ? (
        <p className="mt-1 text-sm text-ink-muted">
          You have been invited to {ROLE_WORDS[invite.role] ?? "staff"} at{" "}
          <strong>{invite.clinicName}</strong>, for <strong>{invite.email}</strong>.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">
          Enter the invitation code a doctor at the clinic sent you.
        </p>
      )}

      <InviteForm code={typeof code === "string" ? code : ""} />

      <p className="mt-6 text-sm text-ink-muted">
        Are you a patient?{" "}
        <Link href="/register" className="font-medium text-accent-ink hover:underline">
          Activate your patient account
        </Link>
      </p>
    </div>
  );
}
