import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { Nav } from "@/components/nav";
import type { NavLink } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The frame every signed-in clinic screen shares — the doctor's and the front
 * desk's: a sidebar on a wide screen; on a phone, a slim bar with the sections
 * as scrolling pills beneath it.
 */
export function AppShell({
  home,
  links,
  context,
  person,
  narrow = false,
  children,
}: {
  home: string;
  links: readonly NavLink[];
  /** A line under the logo: which clinic, which side of it. */
  context?: string;
  person: { name: string; detail: string };
  /** Settings-style pages read better at a form's width. */
  narrow?: boolean;
  children: ReactNode;
}) {
  const initials = person.name
    .replace(/^(Dr\.?|Dra\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface">
        <div className="px-5 pt-6 pb-5">
          <Brand href={home} />
          {context ? <p className="mt-2 truncate text-xs text-ink-faint">{context}</p> : null}
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <Nav orientation="sidebar" links={links} home={home} />
        </div>
        <PersonCard name={person.name} detail={person.detail} initials={initials} />
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Brand href={home} />
            {context ? <p className="mt-0.5 truncate text-xs text-ink-faint">{context}</p> : null}
          </div>
          <Link
            href="/account"
            aria-label={`${person.name} — account`}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-semibold text-accent-ink"
          >
            {initials}
          </Link>
        </div>
        <Nav orientation="bar" links={links} home={home} />
      </header>

      <main className="min-w-0 flex-1">
        <div className={`mx-auto w-full ${narrow ? "max-w-4xl" : "max-w-6xl"} px-4 py-6 sm:px-6 lg:px-10 lg:py-10`}>{children}</div>
      </main>
    </div>
  );
}

function PersonCard({ name, detail, initials }: { name: string; detail: string; initials: string }) {
  return (
    <div className="border-t border-border p-3">
      <Link
        href="/account"
        className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-surface-muted"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-semibold text-accent-ink"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-ink-faint">{detail}</p>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 px-2 pt-2">
        <span className="text-xs text-ink-faint">Theme</span>
        <ThemeToggle />
      </div>
      <form action={logout}>
        <button className="mt-1 w-full rounded-full px-3 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
