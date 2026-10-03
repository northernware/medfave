import { HeartMark, Lockup } from "@/components/brand";
import type { EmergencyCard } from "@/lib/emergency";

/** What the card shows: one clinic's record, or all of them side by side. */
export type CardFace = {
  name: string;
  born: string;
  bloodType: string | null;
  bloodTypeDisagrees: boolean;
  allergies: { label: string; severe: boolean }[];
  noKnownAllergies: boolean;
  conditions: string[];
  medicines: string[];
  address: string | null;
  contacts: { name: string; relationship: string | null; number: string | null }[];
  physician: { name: string; specialty: string | null; phone: string | null } | null;
  source: string;
};

const MAX_ITEMS = 4;

/**
 * The emergency card, landscape and in bank-card proportions, as in the app
 * (medfave-mobile features/emergency-card-face.tsx): an emergency-red band
 * carrying the white logo and the blood type, then who they are, who to ring,
 * what a medic must know, and their doctor. Sized in `cqw` so the whole card
 * scales with its container, on screen and in print.
 */
export function EmergencyCardFace({ face }: { face: CardFace }) {
  return (
    <div
      className="@container aspect-[85.6/54] w-full min-w-0 overflow-hidden rounded-[4cqw] bg-white shadow-card ring-1 ring-black/10"
      style={{ containerType: "inline-size" }}
    >
      <div className="flex h-full">
        {/* The band: who made it, what it is, and the fact read first. */}
        <div className="relative flex w-[29%] shrink-0 flex-col justify-between overflow-hidden bg-emergency p-[3cqw]">
          <HeartMark tone="white" className="absolute -right-[6cqw] -bottom-[5cqw] size-[23cqw] opacity-15" />
          <div className="relative space-y-[1.5cqw]">
            <Lockup tone="white" className="h-[3.4cqw] w-auto" />
            <p className="text-[1.9cqw] leading-[1.3] font-semibold tracking-[0.18em] text-white">
              EMERGENCY
              <br />
              CARD
            </p>
          </div>
          <div className="relative">
            <p className="inline-block min-w-[14cqw] rounded-[2.6cqw] bg-white px-[2.6cqw] py-[1cqw] text-center font-display text-[5.8cqw] leading-none font-semibold text-emergency">
              {face.bloodType ?? "—"}
            </p>
            <p className="mt-[0.8cqw] text-[1.6cqw] font-semibold tracking-[0.14em] text-white">
              {face.bloodTypeDisagrees ? "BLOOD TYPE · CHECK" : "BLOOD TYPE"}
            </p>
          </div>
        </div>

        {/* Who they are and where they live; who to ring; the medical lists; their doctor. */}
        <div className="flex min-w-0 flex-1 flex-col gap-[2.5cqw] px-[3cqw] pt-[2.7cqw] pb-[2cqw]">
          <div>
            <p className="line-clamp-2 font-display text-[3.7cqw] leading-[1.15] font-semibold text-brand-plum">
              {face.name}
            </p>
            <p className="truncate text-[1.95cqw] text-brand-gray">Born {face.born}</p>
            <p className="truncate text-[2cqw] text-brand-gray">{face.address ?? "Address not recorded"}</p>
          </div>

          <div>
            <Label>EMERGENCY CONTACTS</Label>
            {face.contacts.length === 0 ? <Muted>Not recorded</Muted> : null}
            {face.contacts.slice(0, 2).map((c, i) => (
              <p key={i} className="flex items-baseline gap-[1.2cqw] text-[2.1cqw] leading-[1.45] text-brand-plum">
                <span className="w-[11cqw] shrink-0 text-[1.5cqw] font-semibold tracking-[0.1em] text-emergency">
                  {i === 0 ? "PRIMARY" : "SECONDARY"}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {c.name}
                  {c.relationship ? <span className="font-normal text-brand-gray"> ({c.relationship})</span> : null}
                </span>
                {c.number ? <span className="shrink-0 font-semibold">{c.number}</span> : null}
              </p>
            ))}
          </div>

          {/* The rest of the card is theirs: one item per line, as many as fit. */}
          <div className="flex min-h-0 flex-1 gap-[2cqw]">
            <Column
              title="ALLERGIES"
              empty={face.noKnownAllergies ? "None known" : "Not recorded"}
              items={face.allergies.map((a) => ({ text: `${a.severe ? "⚠ " : ""}${a.label}`, severe: a.severe }))}
            />
            <Column title="CONDITIONS" empty="None recorded" items={face.conditions.map((text) => ({ text }))} />
            <Column title="MEDICATIONS" empty="None recorded" items={face.medicines.map((text) => ({ text }))} wide />
          </div>

          <div>
            <Label>PRIMARY CARE PHYSICIAN</Label>
            {face.physician ? (
              <p className="flex items-baseline gap-[1.5cqw] text-[2.1cqw] leading-[1.45] text-brand-plum">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {face.physician.name}
                  {face.physician.specialty ? (
                    <span className="font-normal text-brand-gray"> · {face.physician.specialty}</span>
                  ) : null}
                </span>
                {face.physician.phone ? <span className="shrink-0 font-semibold">{face.physician.phone}</span> : null}
              </p>
            ) : (
              <Muted>Not recorded</Muted>
            )}
            <p className="mt-[0.6cqw] truncate text-[1.45cqw] text-brand-gray/70">{face.source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[1.55cqw] font-semibold tracking-[0.12em] text-brand-gray">{children}</p>
);
const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[2.1cqw] leading-[1.45] text-brand-gray">{children}</p>
);

/** One medical list, an item per line, then "+N more". */
function Column({
  title,
  items,
  empty,
  wide = false,
}: {
  title: string;
  items: { text: string; severe?: boolean }[];
  empty: string;
  wide?: boolean;
}) {
  const shown = items.length > MAX_ITEMS ? items.slice(0, MAX_ITEMS - 1) : items;
  return (
    <div className={wide ? "min-w-0 flex-[1.2]" : "min-w-0 flex-1"}>
      <Label>{title}</Label>
      {items.length === 0 ? <Muted>{empty}</Muted> : null}
      {shown.map((it, i) => (
        <p
          key={i}
          className={`truncate text-[2cqw] leading-[1.45] ${it.severe ? "font-semibold text-emergency" : "text-brand-plum"}`}
        >
          {it.text}
        </p>
      ))}
      {items.length > shown.length ? <Muted>+{items.length - shown.length} more</Muted> : null}
    </div>
  );
}

const medLine = (m: { label: string; dosage: string | null }) => [m.label, m.dosage].filter(Boolean).join(" ");

/** "April 12, 1979 (47)" */
function bornLine(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y) return "—";
  const now = new Date();
  const age = now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${date} (${age})`;
}

/** The card's own shape, from a card and the clinic chosen (or all of them). */
export function faceOf(card: EmergencyCard, clinicId?: string): CardFace {
  const one = clinicId ? card.clinics.find((r) => r.clinicId === clinicId) : undefined;
  if (one) {
    return {
      name: card.name,
      born: bornLine(card.dateOfBirth),
      bloodType: one.bloodType,
      bloodTypeDisagrees: false,
      allergies: one.allergies.map((a) => ({ label: a.label, severe: a.severity === "SEVERE" })),
      noKnownAllergies: one.allergyStatus === "NONE_KNOWN",
      conditions: one.conditions,
      medicines: one.medications.map(medLine),
      address: one.address,
      contacts: one.contacts,
      physician: one.physician,
      source: `From ${one.clinicName} · updated ${one.updatedAt}`,
    };
  }
  const g = card.general;
  return {
    name: card.name,
    born: bornLine(card.dateOfBirth),
    bloodType: g.bloodTypes.map((b) => b.value).join(" / ") || null,
    bloodTypeDisagrees: g.bloodTypeDisagrees,
    allergies: g.allergies.map((a) => ({ label: a.label, severe: a.severity === "SEVERE" })),
    noKnownAllergies: g.noKnownAllergies,
    conditions: g.conditions.map((c) => c.label),
    medicines: g.medications.map(medLine),
    address: g.address,
    contacts: g.contacts,
    physician: g.physician,
    source: `From ${card.clinics.map((r) => r.clinicName).join(", ")}`,
  };
}
