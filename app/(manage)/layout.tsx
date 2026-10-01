import type { ReactNode } from "react";
import { getViewer, requireClinicManager } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MANAGE_LINKS, type NavLink, type ViewKey } from "@/components/nav-links";

/**
 * Running the clinic, as opposed to practising in it.
 *
 * Open to the clinician and to an administrator. An administrator has no
 * doctor view, and this is where they land; a doctor switches back with the
 * view switch (once verified).
 */
export default async function ManageLayout({ children }: { children: ReactNode }) {
  const manager = await requireClinicManager();
  const viewer = await getViewer();
  const links: NavLink[] = [MANAGE_LINKS.clinic, MANAGE_LINKS.details, MANAGE_LINKS.schedule];
  if (manager.clinicOpen) links.push(MANAGE_LINKS.staff);
  if (viewer?.platformAdmin) links.push(MANAGE_LINKS.admin);

  const doctorView = Boolean(manager.doctorId && viewer?.verification?.status === "VERIFIED");
  const views: ViewKey[] = [...(doctorView ? (["doctor"] as const) : []), ...(manager.clinicOpen ? (["desk"] as const) : []), "settings"];

  return (
    <AppShell
      home="/manage"
      links={links}
      clinic={{ id: manager.clinicId, name: manager.clinicName, role: manager.role === "ADMIN" ? "Administrator" : "Doctor" }}
      views={views}
      view="settings"
      person={{ name: manager.fullName, detail: manager.role === "ADMIN" ? "Administrator" : "Doctor" }}
      narrow>
      {children}
    </AppShell>
  );
}
