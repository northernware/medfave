"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; icon: string };

/** The doctor's sections. */
export const DOCTOR_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Today", icon: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/calendar", label: "Calendar", icon: "M8 3v4M16 3v4M4 9h16M5 5h14v16H5z" },
  { href: "/appointments", label: "Appointments", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/households", label: "Households", icon: "M4 20v-2a4 4 0 014-4h1m7 6v-2a4 4 0 00-3-3.9M9 7a3 3 0 106 0 3 3 0 10-6 0m8 3a2.5 2.5 0 100-5" },
  { href: "/patients", label: "Patients", icon: "M12 11a4 4 0 100-8 4 4 0 000 8zM5 21v-1a7 7 0 0114 0v1" },
  { href: "/documents", label: "Records requests", icon: "M8 4h8l4 4v12H4V4h4zm8 0v4h4M8 13h8M8 17h5" },
  { href: "/desk", label: "Front desk", icon: "M4 19h16M6 19V9l6-4 6 4v10M10 19v-5h4v5" },
  { href: "/manage/schedule", label: "My hours", icon: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  // Details, schedules, staff and chart sharing live under Manage.
  { href: "/manage", label: "Clinic settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

/** The front desk's sections, and for a doctor covering it, the way back. */
export const DESK_LINKS: readonly NavLink[] = [
  { href: "/desk", label: "Today", icon: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/desk/appointments", label: "Appointments", icon: "M8 3v4M16 3v4M4 9h16M5 5h14v16H5z" },
  { href: "/desk/requests", label: "Requests", icon: "M4 6h16v10H8l-4 4V6zM8 10h8M8 13h5" },
  { href: "/desk/patients", label: "Patients", icon: "M12 11a4 4 0 100-8 4 4 0 000 8zM5 21v-1a7 7 0 0114 0v1" },
];
export const CLINICAL_VIEW: NavLink = {
  href: "/dashboard",
  label: "Clinical view",
  icon: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
};

/** A section's home is active only on itself; the others also on the pages under them. */
function isActive(pathname: string, href: string, home: string) {
  return href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  orientation,
  links = DOCTOR_LINKS,
  home = "/dashboard",
}: {
  orientation: "sidebar" | "bar";
  links?: readonly NavLink[];
  home?: string;
}) {
  const pathname = usePathname();
  const sidebar = orientation === "sidebar";

  return (
    <nav
      aria-label="Main"
      className={sidebar ? "flex flex-col gap-1" : "flex gap-1.5 overflow-x-auto px-4 pb-3"}
    >
      {links.map((link) => {
        const active = isActive(pathname, link.href, home);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex items-center gap-3 rounded-full py-2 text-sm leading-5 font-medium whitespace-nowrap transition-colors",
              sidebar ? "px-3.5" : "px-3",
              active
                ? "bg-accent-soft font-semibold text-accent-ink"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            ].join(" ")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-[18px] shrink-0"
            >
              <path d={link.icon} />
            </svg>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
