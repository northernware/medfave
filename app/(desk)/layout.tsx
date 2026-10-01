import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DESK_LINKS, type ViewKey } from "@/components/nav-links";

const ROLE = { SECRETARY: "Secretary", ADMIN: "Administrator", DOCTOR: "Doctor" } as const;

/**
 * The front of the clinic.
 *
 * Open to any member of staff, secretaries included — and to a doctor covering
 * the desk, who switches back with the view switch. Nothing clinical is
 * reachable from here; the pages under it deal in times, names and phone
 * numbers.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const views: ViewKey[] =
    staff.role === "DOCTOR" ? ["doctor", "desk", "settings"] : staff.role === "ADMIN" ? ["desk", "settings"] : ["desk"];

  return (
    <AppShell
      home="/desk"
      links={DESK_LINKS}
      clinic={{ id: staff.clinicId, name: staff.clinicName, role: ROLE[staff.role] }}
      views={views}
      view="desk"
      person={{ name: staff.fullName, detail: ROLE[staff.role] }}>
      {children}
    </AppShell>
  );
}
