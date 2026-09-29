"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Today", icon: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/calendar", label: "Calendar", icon: "M8 3v4M16 3v4M4 9h16M5 5h14v16H5z" },
  { href: "/appointments", label: "Appointments", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/households", label: "Households", icon: "M4 20v-2a4 4 0 014-4h1m7 6v-2a4 4 0 00-3-3.9M9 7a3 3 0 106 0 3 3 0 10-6 0m8 3a2.5 2.5 0 100-5" },
  { href: "/patients", label: "Patients", icon: "M12 11a4 4 0 100-8 4 4 0 000 8zM5 21v-1a7 7 0 0114 0v1" },
  { href: "/documents", label: "Records requests", icon: "M8 4h8l4 4v12H4V4h4zm8 0v4h4M8 13h8M8 17h5" },
  { href: "/desk", label: "Front desk", icon: "M4 19h16M6 19V9l6-4 6 4v10M10 19v-5h4v5" },
  { href: "/manage/staff", label: "Staff", icon: "M9 7a3 3 0 106 0 3 3 0 10-6 0M4 20v-1a5 5 0 015-5h2a5 5 0 015 5v1M17 11a2.5 2.5 0 100-5" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ orientation }: { orientation: "sidebar" | "bar" }) {
  const pathname = usePathname();
  const sidebar = orientation === "sidebar";

  return (
    <nav
      aria-label="Main"
      className={sidebar ? "flex flex-col gap-1" : "flex gap-1.5 overflow-x-auto px-4 pb-3"}
    >
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
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
