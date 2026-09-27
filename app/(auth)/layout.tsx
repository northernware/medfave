import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";
import { Brand } from "@/components/brand";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Somebody already signed in has no business on the sign-in page, and where
  // they belong depends on what they are.
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer));

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/*
        The brand panel. The heart + plus pattern fills it, but the words sit on
        a quiet, unpatterned block — text never goes over the pattern.
      */}
      <aside
        aria-hidden="true"
        className="brand-pattern relative hidden border-r border-border lg:flex lg:items-end lg:p-10"
      >
        <div className="max-w-md rounded-xl bg-canvas p-9 shadow-pop">
          <p className="font-display text-[48px] leading-[56px] font-semibold tracking-[-0.02em] text-balance text-ink">
            Care, with a little heart.
          </p>
          <p className="mt-4 text-base leading-6 text-ink-muted text-pretty">
            Appointments and records for family practice, kept together by household.
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <div className="px-6 pt-6 sm:px-10 sm:pt-8">
          <Brand href="/login" />
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:px-10 sm:pt-0 sm:pb-24">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
