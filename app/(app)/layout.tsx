import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireDoctor } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Nav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // A convenience gate for the whole section. Every query and action re-checks
  // on its own — a layout guard alone would not protect direct POSTs.
  const doctor = await requireDoctor();

  const initials = doctor.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="lg:flex lg:min-h-dvh">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface">
        <div className="px-5 pt-6 pb-5">
          <Brand href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <Nav orientation="sidebar" />
        </div>
        <DoctorCard name={doctor.fullName} detail={doctor.specialty ?? doctor.email} initials={initials} />
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand href="/dashboard" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={logout}>
              <button className="text-sm font-medium text-ink-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
        <Nav orientation="bar" />
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

function DoctorCard({ name, detail, initials }: { name: string; detail: string; initials: string }) {
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
