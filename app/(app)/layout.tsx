import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireDoctor } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Nav } from "@/components/nav";

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
      <aside className="hidden lg:flex lg:w-[236px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface">
        <div className="px-4 py-4">
          <Brand />
        </div>
        <div className="flex-1 px-2.5">
          <Nav orientation="sidebar" />
        </div>
        <DoctorCard name={doctor.fullName} detail={doctor.specialty ?? doctor.email} initials={initials} />
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <form action={logout}>
            <button className="text-sm font-medium text-ink-muted hover:text-ink">Sign out</button>
          </form>
        </div>
        <Nav orientation="bar" />
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

function DoctorCard({ name, detail, initials }: { name: string; detail: string; initials: string }) {
  return (
    <div className="border-t border-border p-3">
      <Link
        href="/account"
        className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted"
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-ink-faint">{detail}</p>
        </div>
      </Link>
      <form action={logout}>
        <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
