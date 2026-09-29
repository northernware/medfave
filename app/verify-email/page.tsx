import type { Metadata } from "next";
import Link from "next/link";
import { confirmEmail } from "@/app/actions/sign-up";
import { Brand } from "@/components/brand";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm your email" };

/**
 * Where the emailed link lands. Confirming takes a press of the button, not
 * just the visit: mail security scanners open every link in a message, and
 * would otherwise use the link up before its owner ever saw it.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { code, done, failed } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Brand />
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
        {done ? (
          <>
            <h1 className="text-[28px] leading-9 font-semibold">Email confirmed</h1>
            <p className="mt-2 text-sm text-ink-muted">Thank you. You can close this page, or carry on in medfave.</p>
            <Link href="/login" className={buttonClass("primary", "mt-6 w-full")}>
              Continue to medfave
            </Link>
          </>
        ) : failed || typeof code !== "string" ? (
          <>
            <h1 className="text-[28px] leading-9 font-semibold">That link doesn&rsquo;t work</h1>
            <p className="mt-2 text-sm text-ink-muted">
              It may have expired, or been used already. Sign in and ask for a new one from your welcome page.
            </p>
            <Link href="/login" className={buttonClass("primary", "mt-6 w-full")}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[28px] leading-9 font-semibold">Confirm your email</h1>
            <p className="mt-2 text-sm text-ink-muted">One tap, and medfave knows this inbox is yours.</p>
            <form action={confirmEmail} className="mt-6">
              <input type="hidden" name="code" value={code} />
              <button className={buttonClass("primary", "w-full")}>Confirm my email</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
