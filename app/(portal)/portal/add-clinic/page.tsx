import type { Metadata } from "next";
import Link from "next/link";
import { requirePatientAccount } from "@/lib/auth";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { AddClinicForm } from "./add-clinic-form";

export const metadata: Metadata = { title: "Add a clinic" };

/**
 * Another clinic's activation code, redeemed by somebody who already has a
 * medfave login. That clinic's chart joins the login; its records stay its own.
 */
export default async function AddClinicPage({ searchParams }: PageProps<"/portal/add-clinic">) {
  const me = await requirePatientAccount();
  const { code } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add a clinic"
        subtitle={`Linked now: ${me.charts.map((c) => c.clinicName).join(", ")}`}
        actions={
          <Link href="/portal" className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />
      <Card>
        <div className="space-y-2 px-5 pt-5 text-sm text-ink-muted">
          <p>
            Seen at another clinic that uses medfave? Ask their desk for an activation code and enter it here — it
            links that clinic to this same login, so you don&rsquo;t need a second account.
          </p>
          <p>Each clinic keeps its own records. One clinic never sees another&rsquo;s.</p>
        </div>
        <AddClinicForm code={typeof code === "string" ? code : ""} />
      </Card>
    </div>
  );
}
