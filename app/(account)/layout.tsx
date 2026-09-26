import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { requireViewer } from "@/lib/auth";
import { Brand } from "@/components/brand";

/**
 * A shell of its own, because this page belongs to no role.
 *
 * The doctor, desk and portal shells each assume something about who is
 * looking — a clinical sidebar, a front-desk nav, a patient's own corner. An
 * account page is the one screen all three share, so it sits outside them and
 * offers a way back to wherever the viewer actually lives.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand href="/account" />
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-ink-muted">{viewer.email}</span>
            <form action={logout}>
              <button className="text-[13px] font-medium text-ink-muted hover:text-ink">
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
