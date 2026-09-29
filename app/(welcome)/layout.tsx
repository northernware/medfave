import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { homeFor, requireViewer } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Home for an account that isn't linked to anything yet: signed up, but not a
 * patient anywhere or a member of a clinic. Anybody who is goes to their own home.
 */
export default async function WelcomeLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const home = homeFor(viewer);
  if (home !== "/welcome") redirect(home);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Brand href="/welcome" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{viewer.email}</span>
            <ThemeToggle />
            <form action={logout}>
              <button className="text-sm font-medium text-ink-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
