import type { ReactNode } from "react";
import { getViewer, requireClinicManager } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MANAGE_LINKS, type NavLink } from "@/components/nav-links";

/**
 * Running the clinic, as opposed to practising in it.
 *
 * Open to the clinician and to an administrator, which is why it is its own
 * section rather than a page inside the clinical one: an administrator has no
 * clinical sidebar to hang it off, and this is where they land. A clinician
 * arriving from their own section gets a way back. Same frame as the rest.
 */
export default async function ManageLayout({ children }: { children: ReactNode }) {
  const manager = await requireClinicManager();
  const viewer = await getViewer();
  const links: NavLink[] = [MANAGE_LINKS.clinic, MANAGE_LINKS.details, MANAGE_LINKS.schedule];
  if (manager.clinicOpen) links.push(MANAGE_LINKS.staff);
  if (viewer?.platformAdmin) links.push(MANAGE_LINKS.admin);
  if (manager.doctorId && viewer?.verification?.status === "VERIFIED") links.push(MANAGE_LINKS.consulting);

  return (
    <AppShell
      home="/manage"
      links={links}
      context={`${manager.clinicName} · Clinic settings`}
      person={{ name: manager.fullName, detail: manager.role === "ADMIN" ? "Administrator" : "Doctor" }}
      narrow>
      {children}
    </AppShell>
  );
}
