import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requirePatientAccount } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The patient's own corner.
 *
 * Everything under here is scoped to one chart — the one this login was
 * activated against. Not the household, not the clinic: a person's own
 * appointments and the documents the clinic chose to share with them.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const patient = await requirePatientAccount();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand href="/portal" />
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="text-sm text-ink-muted transition-colors hover:text-ink hover:underline"
            >
              {patient.fullName}
            </Link>
            <ThemeToggle />
            <form action={logout}>
              <button className="text-sm font-medium text-ink-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
