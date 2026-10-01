import type { ReactNode } from "react";
import { choosePortalClinic, choosePortalPerson } from "@/app/actions/portal";
import { requirePatientAccount } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PATIENT_LINKS } from "@/components/nav-links";

/**
 * The patient's own corner, in the same frame as the clinic's screens.
 *
 * Everything under here is scoped to one chart: this person's chart at the
 * clinic they have chosen. A login may be linked to several clinics; the
 * clinic switcher moves between them, each shown on its own — never merged.
 * At one clinic a login may also look after somebody else (a child); the
 * person switch moves between their charts the same way.
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const patient = await requirePatientAccount();
  const clinics = patient.charts
    .filter((c, i, all) => all.findIndex((o) => o.clinicId === c.clinicId) === i)
    .map((c) => ({ id: c.clinicId, name: c.clinicName }));
  const people = patient.charts.filter((c) => c.clinicId === patient.clinicId);

  return (
    <AppShell
      home="/portal"
      links={PATIENT_LINKS}
      clinic={{ id: patient.clinicId, name: patient.clinicName, role: "Patient" }}
      clinics={clinics}
      switchClinic={choosePortalClinic}
      addClinicHref="/portal/add-clinic"
      views={[]}
      person={{ name: patient.fullName, detail: patient.email }}
      narrow>
      {people.length > 1 ? (
        <nav aria-label="Whose records" className="mb-5 flex flex-wrap gap-2">
          {people.map((c) => {
            const current = c.id === patient.patientId;
            return (
              <form key={c.id} action={choosePortalPerson}>
                <input type="hidden" name="patientId" value={c.id} />
                <button
                  aria-current={current ? "true" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    current
                      ? "border-accent bg-accent text-on-accent"
                      : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink"
                  }`}
                >
                  {c.self ? "Me" : c.name.split(/\s+/)[0]}
                </button>
              </form>
            );
          })}
        </nav>
      ) : null}
      {children}
    </AppShell>
  );
}
