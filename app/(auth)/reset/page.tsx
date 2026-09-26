import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const { code } = await searchParams;

  // The code is not checked here. Saying "this link is valid" before a password
  // has been chosen would confirm that the address it went to has an account,
  // which is the one thing the form that sent it declines to say.
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Choosing one signs out every device currently signed in as you.
      </p>

      <ResetForm code={typeof code === "string" ? code : ""} />

      <p className="mt-6 text-sm text-ink-muted">
        Link expired?{" "}
        <Link href="/forgot" className="font-medium text-accent-ink hover:underline">
          Ask for another
        </Link>
      </p>
    </div>
  );
}
