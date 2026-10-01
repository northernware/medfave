"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { CheckCircleIcon } from "@solar-icons/react/linear/check-circle";
import { Logout2Icon } from "@solar-icons/react/linear/logout-2";
import { UserCircleIcon } from "@solar-icons/react/linear/user-circle";
import { logout } from "@/app/actions/auth";
import { VIEWS, type ViewKey } from "@/components/nav-links";

/** Open/closed, closing on an outside click, Escape, or moving to another page. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [at, setAt] = useState(pathname);
  if (at !== pathname) {
    setAt(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const PANEL = "squircle absolute z-30 min-w-60 rounded-xl border border-border bg-surface p-1.5 shadow-pop";
const ROW = "squircle flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-muted";

export function initialsOf(name: string) {
  return name
    .replace(/^(Dr\.?|Dra\.?)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Which clinic this is, at the top of the sidebar. Built for a doctor who
 * works at several: the list shows each, the current one ticked. Today every
 * login belongs to one clinic, so the list has one entry.
 */
export function ClinicSwitcher({
  clinic,
  clinics,
  compact = false,
}: {
  clinic: { id: string; name: string; role: string };
  clinics: { id: string; name: string }[];
  compact?: boolean;
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={[
          "squircle flex w-full min-w-0 items-center gap-2.5 text-left transition-colors",
          compact ? "rounded-lg p-1" : "rounded-xl border border-border bg-surface-muted/60 p-2 hover:bg-surface-muted",
        ].join(" ")}
      >
        <span className="squircle grid size-9 shrink-0 place-items-center rounded-lg bg-brand font-display text-xs font-bold text-white">
          {initialsOf(clinic.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{clinic.name}</span>
          <span className="block truncate text-xs text-ink-faint">{clinic.role}</span>
        </span>
        <AltArrowDownIcon className={`size-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div role="menu" className={`${PANEL} top-full left-0 mt-1.5 w-full`}>
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">Your clinics</p>
          {clinics.map((c) => (
            <div key={c.id} role="menuitem" className={ROW}>
              <span className="squircle grid size-7 place-items-center rounded-md bg-brand/90 text-[10px] font-bold text-white">
                {initialsOf(c.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {c.id === clinic.id ? <CheckCircleIcon className="size-4 text-accent-ink" aria-label="Current" /> : null}
            </div>
          ))}
          <p className="px-2.5 pt-2 pb-1 text-xs text-ink-faint">Working at more than one clinic is coming soon.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Doctor, Front desk, Settings: the same clinic seen from each side this person can work. */
export function ViewSwitch({ views, current }: { views: ViewKey[]; current: ViewKey }) {
  if (views.length < 2) return null;
  return (
    <div className="squircle flex rounded-xl bg-surface-muted p-1" role="tablist" aria-label="View">
      {views.map((v) => (
        <Link
          key={v}
          href={VIEWS[v].href}
          role="tab"
          aria-selected={v === current}
          className={[
            "squircle flex-1 rounded-lg px-1 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors",
            v === current ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
          ].join(" ")}
        >
          {VIEWS[v].label}
        </Link>
      ))}
    </div>
  );
}

/** The person, at the foot of the sidebar (or their initials on a phone): account, theme, sign out. */
export function ProfileMenu({
  person,
  theme,
  compact = false,
}: {
  person: { name: string; detail: string };
  /** The theme control, rendered on the server with the viewer's saved choice. */
  theme: ReactNode;
  compact?: boolean;
}) {
  const { open, setOpen, ref } = usePopover();
  const avatar = (
    <span className="squircle grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-xs font-semibold text-accent-ink">
      {initialsOf(person.name)}
    </span>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `${person.name} — menu` : undefined}
        onClick={() => setOpen(!open)}
        className={compact ? "block" : "squircle flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-surface-muted"}
      >
        {avatar}
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{person.name}</span>
              <span className="block truncate text-xs text-ink-faint">{person.detail}</span>
            </span>
            <AltArrowDownIcon className={`size-4 shrink-0 text-ink-faint transition-transform ${open ? "" : "rotate-180"}`} aria-hidden />
          </>
        )}
      </button>
      {open ? (
        <div role="menu" className={`${PANEL} ${compact ? "top-full right-0 mt-2" : "bottom-full left-0 mb-1.5 w-full"}`}>
          <div className="px-2.5 pt-1.5 pb-2">
            <p className="truncate text-sm font-semibold">{person.name}</p>
            <p className="truncate text-xs text-ink-faint">{person.detail}</p>
          </div>
          <Link href="/account" role="menuitem" className={ROW}>
            <UserCircleIcon className="size-5 text-ink-muted" aria-hidden />
            Account
          </Link>
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-sm">
            <span>Theme</span>
            {theme}
          </div>
          <form action={logout}>
            <button role="menuitem" className={`${ROW} text-danger-ink`}>
              <Logout2Icon className="size-5" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
