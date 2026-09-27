import type { Metadata } from "next";
import Link from "next/link";
import { requireClinicManager } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { Card, CardHeader, Detail, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Clinic" };

const ROLE_WORDS: Record<string, string> = {
  DOCTOR: "clinician",
  ADMIN: "administrator",
  SECRETARY: "secretary",
};

/**
 * Where an administrator lands, and what running the clinic amounts to so far.
 *
 * Kept honest about its own gaps: opening hours are not editable yet, and saying
 * so here is better than a page that looks complete and is not.
 */
export default async function ManagePage() {
  const manager = await requireClinicManager();

  const [clinic, members, liveInvites] = await Promise.all([
    orm.Clinic
      .select("id", "name", "address", "contactNumber")
      .where((c) => c.id.eq(manager.clinicId))
      .first(),
    orm.ClinicMember
      .select("id", "role")
      .where((m) => m.clinicId.eq(manager.clinicId))
      .all(),
    orm.StaffInvite
      .select("id", "acceptedAt", "revokedAt")
      .where((i) => i.clinicId.eq(manager.clinicId))
      .all(),
  ]);

  const counts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const waiting = liveInvites.filter((i) => !i.acceptedAt && !i.revokedAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={clinic?.name ?? manager.clinicName}
        subtitle={`You are signed in as ${ROLE_WORDS[manager.role] ?? "staff"}.`}
        actions={
          <Link href="/manage/staff" className={buttonClass("primary")}>
            Staff
          </Link>
        }
      />

      <Card>
        <CardHeader title="Who works here" />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Detail label="Clinicians" value={String(counts.DOCTOR ?? 0)} />
          <Detail label="Administrators" value={String(counts.ADMIN ?? 0)} />
          <Detail label="Desk" value={String(counts.SECRETARY ?? 0)} />
        </dl>
        {waiting > 0 ? (
          <p className="border-t border-border px-5 py-3 text-[13px] text-ink-muted">
            {waiting === 1 ? "One invitation is" : `${waiting} invitations are`} still outstanding.{" "}
            <Link href="/manage/staff" className="font-medium text-accent-ink hover:underline">
              See them
            </Link>
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Clinic details"
          subtitle="What appears on letterheads and in invitations."
          action={
            <Link href="/manage/clinic" className="font-medium text-accent-ink hover:underline">
              Edit
            </Link>
          }
        />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Detail label="Name" value={clinic?.name} />
          <Detail label="Address" value={clinic?.address} />
          <Detail label="Contact number" value={clinic?.contactNumber} />
        </dl>
        <p className="border-t border-border px-5 py-3 text-xs text-ink-muted">
          Opening hours, breaks and closures are not editable here yet; the clinic runs on the
          application&rsquo;s defaults — Monday to Saturday, 8am to 5pm.
        </p>
      </Card>
    </div>
  );
}
