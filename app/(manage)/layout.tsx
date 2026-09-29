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
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand href="/manage" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label="Clinic" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href="/manage" className="text-ink-muted transition-colors hover:text-ink">
                Clinic
              </Link>
              <Link href="/manage/clinic" className="text-ink-muted transition-colors hover:text-ink">
                Details
              </Link>
              <Link href="/manage/schedule" className="text-ink-muted transition-colors hover:text-ink">
                Schedule
              </Link>
              {manager.clinicOpen ? (
                <Link href="/manage/staff" className="text-ink-muted transition-colors hover:text-ink">
                  Staff
                </Link>
              ) : null}
              {viewer?.platformAdmin ? (
                <Link href="/admin/verify" className="text-ink-muted transition-colors hover:text-ink">
                  Admin
                </Link>
              ) : null}
              {manager.doctorId && viewer?.verification?.status === "VERIFIED" ? (
                <Link href="/dashboard" className="text-ink-muted transition-colors hover:text-ink">
                  Consulting room
                </Link>
              ) : null}
            </nav>
            <Link
              href="/account"
              className="text-sm text-ink-muted transition-colors hover:text-ink hover:underline"
            >
              {manager.fullName}
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
