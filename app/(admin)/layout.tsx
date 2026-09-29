import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requirePlatformAdmin } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/** Running Medfave itself. Platform admins only; everybody else is sent home. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Brand href="/admin/verify" />
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-muted">Admin</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/verify" className="text-ink-muted hover:text-ink">Verify doctors</Link>
            <Link href="/" className="text-ink-muted hover:text-ink">My home</Link>
            <span className="hidden text-ink-muted sm:inline">{admin.email}</span>
            <ThemeToggle />
            <form action={logout}>
              <button className="font-medium text-ink-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
