import type { Metadata } from "next";
import { requirePatientAccount } from "@/lib/auth";
import { emergencyCards, type ClinicRecord, type EmergencyCard } from "@/lib/emergency";
import { Card, PageHeader } from "@/components/ui";
import { choosePhysicianAction } from "@/app/actions/portal";

export const metadata: Metadata = { title: "Emergency card" };

const SEVERITY: Record<string, string> = { SEVERE: "Severe", MODERATE: "Moderate", MILD: "Mild" };

/**
 * What a medic needs, for you and each person you look after: one card that
 * puts every clinic's record side by side (General), and each clinic's own.
 * Read-only — the clinics keep it; something wrong is theirs to correct.
 */
export default async function EmergencyPage({ searchParams }: PageProps<"/portal/emergency">) {
  const me = await requirePatientAccount();
  const { person, clinic } = await searchParams;
  const cards = await emergencyCards({ accountId: me.accountId, fullName: me.fullName, charts: me.charts });
  const card = cards.find((c) => c.key === person) ?? cards[0];
  if (!card) return <PageHeader title="Emergency card" subtitle="Nothing recorded yet." />;
  const one = card.clinics.find((r) => r.clinicId === clinic);

  const tab = (href: string, label: string, on: boolean) => (
    <a
      key={href}
      href={href}
      aria-current={on ? "true" : undefined}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${on ? "border-accent bg-accent text-on-accent" : "border-border bg-surface text-ink-muted hover:text-ink"}`}
    >
      {label}
    </a>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Emergency card" subtitle="What a medic needs to know. From your clinics' records." />
      {cards.length > 1 ? (
        <nav aria-label="Whose card" className="flex flex-wrap gap-2">
          {cards.map((c) => tab(`/portal/emergency?person=${c.key}`, c.self ? "Me" : c.name.split(" ")[0], c.key === card.key))}
        </nav>
      ) : null}
      <nav aria-label="Which record" className="flex flex-wrap gap-2">
        {tab(`/portal/emergency?person=${card.key}`, "General", !one)}
        {card.clinics.length > 1 || one
          ? card.clinics.map((r) => tab(`/portal/emergency?person=${card.key}&clinic=${r.clinicId}`, r.clinicName, r.clinicId === one?.clinicId))
          : null}
      </nav>
      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="font-display text-2xl font-semibold">{card.name}</p>
          <p className="text-sm text-ink-muted">Born {card.dateOfBirth}</p>
        </div>
        {one ? <ClinicView r={one} /> : <GeneralView card={card} />}
      </Card>
      <p className="text-sm text-ink-muted">Something wrong? Ask the clinic to correct it. This card shows exactly what they recorded.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
const From = ({ clinics }: { clinics: string[] }) => <span className="text-xs text-ink-faint"> · {clinics.join(", ")}</span>;

function GeneralView({ card }: { card: EmergencyCard }) {
  const g = card.general;
  return (
    <>
      <Section title="Address">
        <p>{g.address ?? <span className="text-ink-muted">Not recorded</span>}</p>
      </Section>
      <Section title="Blood type">
        {g.bloodTypes.length === 0 ? <p className="text-ink-muted">Not recorded</p> : null}
        {g.bloodTypes.map((b) => (
          <p key={b.value} className="text-lg font-semibold">
            {b.value}
            <From clinics={b.clinics} />
          </p>
        ))}
        {g.bloodTypeDisagrees ? <p className="text-sm text-warn-ink">⚠ Clinics disagree. Ask your doctor.</p> : null}
      </Section>
      <Section title="Allergies">
        {g.allergies.length === 0 ? <p className="text-ink-muted">{g.noKnownAllergies ? "No known allergies" : "Not recorded"}</p> : null}
        {g.allergies.map((a) => (
          <p key={a.label} className={a.severity === "SEVERE" ? "font-semibold text-danger-ink" : "font-medium"}>
            {a.severity === "SEVERE" ? "⚠ " : ""}
            {a.label}
            <span className="font-normal text-ink-muted">
              {a.reaction ? ` — ${a.reaction}` : ""}
              {a.severity ? `, ${SEVERITY[a.severity].toLowerCase()}` : ""}
            </span>
            <From clinics={a.clinics} />
          </p>
        ))}
      </Section>
      <Section title="Medicines">
        {g.medications.length === 0 ? <p className="text-ink-muted">None recorded</p> : null}
        {g.medications.map((m) => (
          <p key={`${m.label}${m.dosage}`}>
            <span className="font-medium">{m.label}</span>
            <span className="text-ink-muted">{[m.dosage, m.frequency].filter(Boolean).length ? ` ${[m.dosage, m.frequency].filter(Boolean).join(", ")}` : ""}</span>
            <From clinics={m.clinics} />
          </p>
        ))}
      </Section>
      <Section title="Conditions">
        {g.conditions.length === 0 ? <p className="text-ink-muted">None recorded</p> : null}
        {g.conditions.map((c) => (
          <p key={c.label}>
            {c.label}
            <From clinics={c.clinics} />
          </p>
        ))}
      </Section>
      <Section title="Emergency contacts">
        {g.contacts.length === 0 ? <p className="text-ink-muted">Not recorded</p> : null}
        {g.contacts.map((c, i) => (
          <p key={`${c.name}${c.number}`}>
            <span className="mr-2 text-xs font-semibold text-ink-muted uppercase">{i === 0 ? "Primary" : "Secondary"}</span>
            <span className="font-medium">{c.name}</span>
            {c.relationship ? <span className="text-ink-muted"> ({c.relationship})</span> : null}
            {c.number ? (
              <a href={`tel:${c.number.replace(/[^\d+]/g, "")}`} className="ml-2 text-accent-ink hover:underline">
                {c.number}
              </a>
            ) : null}
          </p>
        ))}
      </Section>
      <Section title="Primary care physician">
        {g.physician ? <Physician p={g.physician} /> : <p className="text-ink-muted">Not recorded</p>}
        <PhysicianChooser card={card} />
      </Section>
    </>
  );
}

/** Their choice of regular doctor, among those who have seen them; or let the card work it out. */
function PhysicianChooser({ card }: { card: EmergencyCard }) {
  const seen = card.clinics.flatMap((r) => r.doctorsSeen.map((d) => ({ ...d, clinicName: r.clinicName })));
  if (seen.length === 0) return null;
  const chosen = card.general.physician?.chosen ? card.general.physician.doctorId : "";
  return (
    <form action={choosePhysicianAction} className="flex flex-wrap items-center gap-2 pt-1">
      <input type="hidden" name="cardKey" value={card.key} />
      <select name="doctorId" defaultValue={chosen} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm">
        <option value="">Work it out (seen most this year)</option>
        {seen.map((d) => (
          <option key={`${d.id}${d.clinicName}`} value={d.id}>
            {d.name}
            {d.specialty ? ` · ${d.specialty}` : ""} · {d.clinicName}
          </option>
        ))}
      </select>
      <button className="rounded-md px-2.5 py-1.5 text-sm font-medium text-accent-ink hover:underline">Save</button>
    </form>
  );
}

function Physician({ p }: { p: NonNullable<EmergencyCard["general"]["physician"]> }) {
  return (
    <p>
      <span className="font-medium">{p.name}</span>
      {p.specialty ? <span className="text-ink-muted"> · {p.specialty}</span> : null}
      {p.phone ? (
        <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="ml-2 text-accent-ink hover:underline">
          {p.phone}
        </a>
      ) : null}
      <span className="text-xs text-ink-faint">
        {" "}
        · {p.clinicName}
        {p.chosen ? " · your choice" : p.visits ? ` · seen ${p.visits}× this year` : ""}
      </span>
    </p>
  );
}

function ClinicView({ r }: { r: ClinicRecord }) {
  return (
    <>
      <p className="text-sm text-ink-muted">{r.clinicName}&rsquo;s record · updated {r.updatedAt}</p>
      <Section title="Blood type">
        <p className="text-lg font-semibold">{r.bloodType ?? <span className="text-base font-normal text-ink-muted">Not recorded</span>}</p>
      </Section>
      <Section title="Allergies">
        {r.allergies.length === 0 ? <p className="text-ink-muted">{r.allergyStatus === "NONE_KNOWN" ? "No known allergies" : "Not recorded"}</p> : null}
        {r.allergies.map((a) => (
          <p key={a.label} className={a.severity === "SEVERE" ? "font-semibold text-danger-ink" : "font-medium"}>
            {a.label}
            <span className="font-normal text-ink-muted">
              {a.reaction ? ` — ${a.reaction}` : ""}
              {a.severity ? `, ${SEVERITY[a.severity].toLowerCase()}` : ""}
            </span>
          </p>
        ))}
      </Section>
      <Section title="Medicines">
        {r.medications.length === 0 ? <p className="text-ink-muted">{r.medicationStatus === "NONE_KNOWN" ? "None" : "Not recorded"}</p> : null}
        {r.medications.map((m) => (
          <p key={`${m.label}${m.dosage}`}>
            <span className="font-medium">{m.label}</span> <span className="text-ink-muted">{[m.dosage, m.frequency].filter(Boolean).join(", ")}</span>
          </p>
        ))}
      </Section>
      <Section title="Conditions">
        {r.conditions.length === 0 ? <p className="text-ink-muted">{r.conditionStatus === "NONE_KNOWN" ? "None" : "Not recorded"}</p> : null}
        {r.conditions.map((c) => (
          <p key={c}>{c}</p>
        ))}
      </Section>
      <Section title="Primary care physician">
        {r.physician ? <Physician p={r.physician} /> : <p className="text-ink-muted">Not recorded</p>}
      </Section>
      <Section title="Emergency contacts">
        {r.contacts.length === 0 ? <p className="text-ink-muted">Not recorded</p> : null}
        {r.contacts.map((c, i) => (
          <p key={`${c.name}${c.number}`}>
            <span className="mr-2 text-xs font-semibold text-ink-muted uppercase">{i === 0 ? "Primary" : "Secondary"}</span>
            <span className="font-medium">{c.name}</span>
            {c.relationship ? <span className="text-ink-muted"> ({c.relationship})</span> : null}
            {c.number ? <span className="ml-2">{c.number}</span> : null}
          </p>
        ))}
      </Section>
    </>
  );
}
