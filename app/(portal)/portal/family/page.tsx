import type { Metadata } from "next";
import { removeFamilyAction } from "@/app/actions/portal";
import { requirePatientAccount } from "@/lib/auth";
import { listFamily } from "@/lib/family";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { FamilyForm } from "./family-form";

export const metadata: Metadata = { title: "My family" };

const RELATIONSHIP: Record<string, string> = {
  CHILD: "Child",
  SPOUSE: "Spouse",
  PARENT: "Parent",
  SIBLING: "Sibling",
  GRANDPARENT: "Grandparent",
  OTHER: "Other",
};

/**
 * The people this patient books for, and whose records they already look
 * after. The list is theirs and grants nothing; access comes from a clinic
 * accepting a request for somebody, or a caregiver code from the desk.
 */
export default async function FamilyPage() {
  const me = await requirePatientAccount();
  const family0 = await listFamily(me.accountId);
  const lookedAfter = me.charts.filter((c) => !c.self);

  // Your list and the clinics' links, as one family, matched by name: each
  // person once, saying whether a clinic has them yet.
  const key = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
  const family = [
    ...family0.map((m) => {
      const name = `${m.firstName} ${m.middleName ? `${m.middleName} ` : ""}${m.lastName}`;
      const plain = `${m.firstName} ${m.lastName}`;
      return {
        key: m.id,
        name,
        memberId: m.id as string | null,
        detail: `${RELATIONSHIP[m.relationship]} · born ${m.dateOfBirth} · `,
        clinics: lookedAfter.filter((c) => key(c.name) === key(plain)).map((c) => c.clinicName),
      };
    }),
    ...lookedAfter
      .filter((c) => !family0.some((m) => key(`${m.firstName} ${m.lastName}`) === key(c.name)))
      .filter((c, i, all) => all.findIndex((o) => key(o.name) === key(c.name)) === i)
      .map((c) => ({
        key: c.id,
        name: c.name,
        memberId: null as string | null,
        detail: "",
        clinics: lookedAfter.filter((o) => key(o.name) === key(c.name)).map((o) => o.clinicName),
      })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My family" subtitle="The people you book visits for." />

      <Card>
        <CardHeader
          title="Your family"
          subtitle="The people you book for. Someone not linked yet? Ask a doctor for a visit for them in the Medfave app; once the clinic accepts, you can see their visits."
        />
        <ul className="divide-y divide-border">
          {family.length === 0 ? <li className="px-5 py-4 text-sm text-ink-muted">Nobody yet.</li> : null}
          {family.map((f) => (
            <li key={f.key} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{f.name}</p>
                <p className="text-ink-muted">
                  {f.detail}
                  {f.clinics.length ? (
                    <span className="text-ok-ink">{f.clinics.join(", ")} · you can see their records</span>
                  ) : (
                    "not linked to a clinic yet"
                  )}
                </p>
              </div>
              {f.memberId ? (
                <form action={removeFamilyAction}>
                  <input type="hidden" name="id" value={f.memberId} />
                  <button className={buttonClass("secondary")}>Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-5 py-5">
          <FamilyForm />
        </div>
      </Card>
    </div>
  );
}
