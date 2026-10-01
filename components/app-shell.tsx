import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Nav } from "@/components/nav";
import type { NavLink, ViewKey } from "@/components/nav-links";
import { ClinicSwitcher, ProfileMenu, ViewSwitch } from "@/components/shell-menus";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The frame every signed-in clinic screen shares — doctor, front desk and
 * clinic settings. Built like a multi-clinic platform: the clinic at the top
 * (a switcher, ready for doctors who work at several), the views this person
 * can work in (Doctor / Front desk / Settings), the sections in groups, and the
 * person at the foot with account, theme and sign-out in a menu. On a phone: a
 * slim bar with the clinic and the person, and the sections as pills.
 */
export function AppShell({
  home,
  links,
  clinic,
  clinics,
  views,
  view,
  person,
  narrow = false,
  wide = false,
  children,
}: {
  home: string;
  links: readonly NavLink[];
  /** The clinic being worked in, and this person's role there. */
  clinic: { id: string; name: string; role: string };
  /** Every clinic this login works at (one, for now). */
  clinics?: { id: string; name: string }[];
  /** The views this person may switch between, and the one this is. */
  views: ViewKey[];
  view: ViewKey;
  person: { name: string; detail: string };
  /** Settings-style pages read better at a form's width. */
  narrow?: boolean;
  /** Dashboards use the whole width of the window. */
  wide?: boolean;
  children: ReactNode;
}) {
  const all = clinics ?? [{ id: clinic.id, name: clinic.name }];
  const theme = <ThemeToggle />;

  return (
    <div className="lg:flex lg:min-h-dvh">
      {/* A floating panel, inset from the window's edges, like the reference design. */}
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-[280px] lg:shrink-0 lg:p-3 lg:pr-0">
      <aside className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface px-3 py-5 shadow-card">
        <div className="px-2">
          <Brand href={home} />
        </div>
        <ClinicSwitcher clinic={clinic} clinics={all} />
        <ViewSwitch views={views} current={view} />
        <div className="-mx-1 flex-1 overflow-y-auto px-1 pt-1">
          <Nav orientation="sidebar" links={links} home={home} />
        </div>
        <div className="border-t border-border pt-3">
          <ProfileMenu person={person} theme={theme} />
        </div>
      </aside>
      </div>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <ClinicSwitcher clinic={clinic} clinics={all} compact />
          </div>
          <ProfileMenu person={person} theme={theme} compact />
        </div>
        {views.length > 1 ? (
          <div className="px-4 pb-2">
            <ViewSwitch views={views} current={view} />
          </div>
        ) : null}
        <Nav orientation="bar" links={links} home={home} />
      </header>

      <main className="min-w-0 flex-1">
        <div className={`mx-auto w-full ${narrow ? "max-w-4xl" : wide ? "max-w-[1680px]" : "max-w-6xl"} px-4 py-6 sm:px-6 lg:px-10 lg:py-10`}>{children}</div>
      </main>
    </div>
  );
}
