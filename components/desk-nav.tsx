"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/desk", label: "Today" },
  { href: "/desk/appointments", label: "Appointments" },
  { href: "/desk/requests", label: "Requests" },
  { href: "/desk/patients", label: "Patients" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/desk"
    ? pathname === "/desk"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function DeskNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Front desk" className="flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-accent font-semibold text-accent-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
