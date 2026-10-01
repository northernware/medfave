import { requireDoctor } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DOCTOR_LINKS } from "@/components/nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // A convenience gate for the whole section. Every query and action re-checks
  // on its own — a layout guard alone would not protect direct POSTs.
  const doctor = await requireDoctor();

  return (
    <AppShell
      home="/dashboard"
      links={DOCTOR_LINKS}
      clinic={{ id: doctor.clinicId, name: doctor.clinicName, role: "Doctor" }}
      views={["doctor", "desk", "settings"]}
      view="doctor"
      person={{ name: doctor.fullName, detail: doctor.specialty ?? doctor.email }}>
      {children}
    </AppShell>
  );
}
