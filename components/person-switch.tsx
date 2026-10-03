import { choosePortalPerson } from "@/app/actions/portal";
import { requirePatientAccount } from "@/lib/auth";

/**
 * Whose records the page shows, when this login looks after somebody too:
 * Me, then each person, at the chosen clinic. Placed under the page heading.
 */
export async function PersonSwitch() {
  const patient = await requirePatientAccount();
  const people = patient.charts.filter((c) => c.clinicId === patient.clinicId);
  if (people.length < 2) return null;
  return (
    <nav aria-label="Whose records" className="flex flex-wrap gap-2">
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
  );
}
