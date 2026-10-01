"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCTOR_LINKS, type NavLink } from "@/components/nav-links";

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
