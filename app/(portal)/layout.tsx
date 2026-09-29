import type { ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { choosePortalClinic } from "@/app/actions/portal";
import { requirePatientAccount } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The patient's own corner.
 *
 * Everything under here is scoped to one chart: this person's chart at the
 * clinic they have chosen (a login may be linked to several clinics). Not the
 * household, not the rest of the clinic: a person's own appointments and the
 * documents that clinic chose to share with them.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const patient = await requirePatientAccount();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand href="/portal" />
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="text-sm text-ink-muted transition-colors hover:text-ink hover:underline"
            >
              {patient.fullName}
            </Link>
            <ThemeToggle />
            <form action={logout}>
              <button className="text-sm font-medium text-ink-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
        {/* Which clinic's chart this is. One login may be linked to several,
            and each is shown on its own — never merged. */}
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 pb-3 text-sm">
          <span className="text-ink-muted">Clinic:</span>
          <span className="rounded-full bg-accent-tint px-3 py-1 font-medium text-accent-ink">
            {patient.clinicName}
          </span>
          {patient.charts
            .filter((c) => c.clinicId !== patient.clinicId)
            .map((c) => (
              <form key={c.clinicId} action={choosePortalClinic}>
                <input type="hidden" name="clinicId" value={c.clinicId} />
                <button className="rounded-full border border-border px-3 py-1 text-ink-muted transition-colors hover:border-accent hover:text-accent-ink">
                  {c.clinicName}
                </button>
              </form>
            ))}
          <Link href="/portal/add-clinic" className="ml-auto font-medium text-accent-ink hover:underline">
            Add a clinic
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
