import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getViewer, requireClinicManager } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Running the clinic, as opposed to practising in it.
 *
 * Open to the clinician and to an administrator, which is why it is its own
 * shell rather than a page inside the clinical section: an administrator has no
 * clinical sidebar to hang it off, and this is where they land. A clinician
 * arriving from their own section gets a way back.
 */
export default async function ManageLayout({ children }: { children: ReactNode }) {
  const manager = await requireClinicManager();
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        {/* Brand and account on one row; the clinic's sections on their own row
            below on a phone, or beside the brand on a wider screen. */}
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Brand href="/manage" />
          <nav
            aria-label="Clinic"
            className="order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-x-4 overflow-x-auto px-4 text-sm sm:order-none sm:mx-0 sm:w-auto sm:px-0"
          >
            <Link href="/manage" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
              Clinic
            </Link>
            <Link href="/manage/clinic" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
              Details
            </Link>
            <Link href="/manage/schedule" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
              Schedule
            </Link>
            {manager.clinicOpen ? (
              <Link href="/manage/staff" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
                Staff
              </Link>
            ) : null}
            {viewer?.platformAdmin ? (
              <Link href="/admin/verify" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
                Admin
              </Link>
            ) : null}
            {manager.doctorId && viewer?.verification?.status === "VERIFIED" ? (
              <Link href="/dashboard" className="text-ink-muted transition-colors hover:text-ink whitespace-nowrap">
                Consulting room
              </Link>
            ) : null}
            <Link href="/account" className="whitespace-nowrap text-ink-muted transition-colors hover:text-ink md:hidden">
              Account
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/account"
              className="hidden max-w-40 truncate text-sm text-ink-muted transition-colors hover:text-ink hover:underline md:inline"
            >
              {manager.fullName}
            </Link>
            <ThemeToggle />
            <form action={logout}>
              <button className="text-sm font-medium whitespace-nowrap text-ink-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
