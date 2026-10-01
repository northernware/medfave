import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CLINIC_SETTINGS, DESK_LINKS, type ViewKey } from "@/components/nav-links";

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
    staff.role === "DOCTOR" ? ["doctor", "desk"] : ["desk"];
  const manages = staff.role !== "SECRETARY";

  return (
    <AppShell
      home="/desk"
      links={manages ? [...DESK_LINKS, CLINIC_SETTINGS] : DESK_LINKS}
      settingsHref={manages ? "/manage" : undefined}
      clinic={{ id: staff.clinicId, name: staff.clinicName, role: ROLE[staff.role] }}
      views={views}
      view="desk"
      wide
      person={{ name: staff.fullName, detail: ROLE[staff.role] }}>
      {children}
    </AppShell>
  );
}
