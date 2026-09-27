import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireStaff } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { DeskNav } from "@/components/desk-nav";

/**
 * The front of the clinic.
 *
 * Open to any member of staff, secretaries included — and to a doctor who
 * happens to be covering the desk. Nothing clinical is reachable from here;
 * the pages under it deal in times, names and phone numbers.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Brand href="/desk" />
            <span className="hidden text-sm text-ink-muted sm:inline">
              {staff.clinicName} · front desk
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* A doctor covering the desk can get back to their own screens. */}
            {staff.role !== "SECRETARY" ? (
              <Link href="/" className="text-sm font-medium text-accent-ink hover:underline">
                Clinical view
              </Link>
            ) : null}
            <Link
              href="/account"
              className="text-sm text-ink-muted transition-colors hover:text-ink hover:underline"
            >
              {staff.fullName}
            </Link>
            <form action={logout}>
              <button className="text-sm font-medium text-ink-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4">
          <DeskNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
