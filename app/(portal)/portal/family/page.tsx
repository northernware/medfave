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
  const family = await listFamily(me.accountId);
  const lookedAfter = me.charts.filter((c) => !c.self);

  return (
    <div className="space-y-6">
      <PageHeader title="My family" subtitle="The people you book visits for." />

      {lookedAfter.length > 0 ? (
        <Card>
          <CardHeader title="You look after" subtitle="Switch to them at the top of any page to see their visits." />
          <ul className="divide-y divide-border">
            {lookedAfter.map((c) => (
              <li key={c.id} className="px-5 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-ink-muted"> · {c.clinicName}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Your family list"
          subtitle="Pick them when you ask a doctor for a visit in the Medfave app. A clinic sees them only then."
        />
        <ul className="divide-y divide-border">
          {family.length === 0 ? <li className="px-5 py-4 text-sm text-ink-muted">Nobody yet.</li> : null}
          {family.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {m.firstName} {m.middleName ? `${m.middleName} ` : ""}
                  {m.lastName}
                </p>
                <p className="text-ink-muted">
                  {RELATIONSHIP[m.relationship]} · born {m.dateOfBirth}
                </p>
              </div>
              <form action={removeFamilyAction}>
                <input type="hidden" name="id" value={m.id} />
                <button className={buttonClass("secondary")}>Remove</button>
              </form>
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
