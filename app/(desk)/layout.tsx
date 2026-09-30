import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CLINICAL_VIEW, DESK_LINKS } from "@/components/nav";

/**
 * The front of the clinic.
 *
 * Open to any member of staff, secretaries included — and to a doctor who
 * happens to be covering the desk, who gets a way back to their own screens.
 * Nothing clinical is reachable from here; the pages under it deal in times,
 * names and phone numbers. Same frame as the doctor's side.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const role = staff.role === "SECRETARY" ? "Secretary" : staff.role === "ADMIN" ? "Administrator" : "Doctor";

  return (
    <AppShell
      home="/desk"
      links={staff.role !== "SECRETARY" ? [...DESK_LINKS, CLINICAL_VIEW] : DESK_LINKS}
      context={`${staff.clinicName} · Front desk`}
      person={{ name: staff.fullName, detail: role }}>
      {children}
    </AppShell>
  );
}
