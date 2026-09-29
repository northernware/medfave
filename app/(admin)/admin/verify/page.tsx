import type { Metadata } from "next";
import { orm } from "@/src/prisma/db";
import { formatDateTime, instantFromDb } from "@/lib/datetime";
import { automaticChecks, PRC_LOOKUP_URL } from "@/lib/practice";
import { Badge, Card, CardHeader, Detail, EmptyState, PageHeader } from "@/components/ui";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Verify doctors" };

/**
 * The verification queue. The automatic checks sit beside each doctor; the
 * licence itself is checked by hand in the PRC's lookup, which has no API.
 */
export default async function VerifyPage() {
  const [pending, recent] = await Promise.all([
    orm.Doctor
      .select("id", "fullName", "specialty", "licenseNumber", "verificationSubmittedAt")
      .include("account", (a) => a.select("email", "fullName", "emailVerifiedAt"))
      .include("clinic", (c) => c.select("name", "address", "contactNumber"))
      .where((d) => d.verificationStatus.eq("PENDING"))
      .orderBy((d) => d.verificationSubmittedAt.asc())
      .all(),
    orm.Doctor
      .select("id", "fullName", "verificationStatus", "verifiedAt", "declineReason", "updatedAt")
      .include("verifiedBy", (a) => a.select("fullName"))
      .where((d) => d.verifiedById.isNotNull())
      .orderBy((d) => d.updatedAt.desc())
      .limit(10)
      .all(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify doctors"
        subtitle={`${pending.length === 0 ? "Nobody" : pending.length === 1 ? "One doctor" : `${pending.length} doctors`} waiting. Check each licence in the PRC lookup, then verify or decline.`}
      />

      {pending.length === 0 ? (
        <EmptyState title="All caught up" description="New doctors appear here when they set up their clinic." />
      ) : (
        pending.map((d) => {
          const checks = automaticChecks({
            emailVerified: Boolean(d.account?.emailVerifiedAt),
            licenseNumber: d.licenseNumber,
            licenceName: d.fullName,
            accountName: d.account?.fullName ?? "",
          });
          return (
            <Card key={d.id}>
              <CardHeader
                title={d.fullName}
                subtitle={`Sent ${d.verificationSubmittedAt ? formatDateTime(instantFromDb(d.verificationSubmittedAt)) : "—"}`}
                action={
                  <a href={PRC_LOOKUP_URL} target="_blank" rel="noreferrer" className="font-medium text-accent-ink hover:underline">
                    Open PRC lookup ↗
                  </a>
                }
              />
              <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                <Detail label="PRC licence" value={d.licenseNumber} />
                <Detail label="Specialty" value={d.specialty} />
                <Detail label="Account" value={`${d.account?.fullName ?? "—"} · ${d.account?.email ?? ""}`} />
                <Detail label="Clinic" value={d.clinic?.name} />
                <Detail label="Address" value={d.clinic?.address} />
                <Detail label="Phone" value={d.clinic?.contactNumber} />
              </dl>
              <ul className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                {checks.map((c) => (
                  <li key={c.label}>
                    <Badge tone={c.ok ? "ok" : "warn"} dot>
                      {c.ok ? "✓" : "✗"} {c.label}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-5 py-4">
                <DecisionForm doctorId={d.id} />
              </div>
            </Card>
          );
        })
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader title="Recent decisions" />
          <ul className="divide-y divide-border">
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium">{d.fullName}</span>
                <span className="text-ink-muted">
                  {d.verificationStatus === "VERIFIED" ? "Verified" : d.verificationStatus === "DECLINED" ? `Declined: ${d.declineReason}` : "Sent again"}
                  {d.verifiedBy ? ` · by ${d.verifiedBy.fullName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
