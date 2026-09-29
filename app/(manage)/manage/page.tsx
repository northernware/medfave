import type { Metadata } from "next";
import Link from "next/link";
import { requireClinicManager } from "@/lib/auth";
import { describeWeek } from "@/lib/availability";
import { clinicDoctorId } from "@/lib/clinic";
import { loadSchedule } from "@/lib/queries";
import { orm } from "@/src/prisma/db";
import { Badge, Card, CardHeader, Detail, PageHeader, buttonClass } from "@/components/ui";
import { ResubmitForm } from "./verification-panel";

export const metadata: Metadata = { title: "Clinic" };

const ROLE_WORDS: Record<string, string> = {
  DOCTOR: "clinician",
  ADMIN: "administrator",
  SECRETARY: "secretary",
};

/** Where an administrator lands: who works here, what the clinic is called, when it opens. */
export default async function ManagePage({ searchParams }: PageProps<"/manage">) {
  const manager = await requireClinicManager();
  const { welcome } = await searchParams;
  const me = manager.doctorId
    ? await orm.Doctor
        .select("fullName", "licenseNumber", "specialty", "verificationStatus", "declineReason")
        .where((d) => d.id.eq(manager.doctorId!))
        .first()
    : null;

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
  const doctorId = await clinicDoctorId(manager.clinicId);
  const week = doctorId ? describeWeek(await loadSchedule(doctorId)) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={clinic?.name ?? manager.clinicName}
        subtitle={`You are signed in as ${ROLE_WORDS[manager.role] ?? "staff"}.`}
        actions={
          manager.clinicOpen ? (
            <Link href="/manage/staff" className={buttonClass("primary")}>
              Staff
            </Link>
          ) : null
        }
      />

      {me && me.verificationStatus === "PENDING" ? (
        <Card>
          <CardHeader
            title={welcome ? "Your clinic is set up" : "Waiting for verification"}
            subtitle="Usually within a day. We'll email you."
            action={<Badge tone="warn" dot>Checking your licence</Badge>}
          />
          <div className="space-y-2 px-5 pb-5 text-sm text-ink-muted">
            <p>
              We&rsquo;re checking PRC licence <strong className="text-ink">{me.licenseNumber}</strong> for{" "}
              <strong className="text-ink">{me.fullName}</strong>. Until it&rsquo;s verified you can&rsquo;t add
              patients, book visits or invite staff.
            </p>
            <p>
              Meanwhile, set up your{" "}
              <Link href="/manage/schedule" className="font-medium text-accent-ink hover:underline">opening hours and services</Link>{" "}
              and{" "}
              <Link href="/manage/clinic" className="font-medium text-accent-ink hover:underline">clinic details</Link>.
            </p>
          </div>
        </Card>
      ) : null}

      {me && me.verificationStatus === "DECLINED" ? (
        <Card>
          <CardHeader
            title="We couldn't verify your licence yet"
            subtitle="Fix the details below and send them again."
            action={<Badge tone="danger">Not verified</Badge>}
          />
          <p className="px-5 pb-4 text-sm">
            <span className="text-ink-muted">Reason: </span>
            {me.declineReason}
          </p>
          <ResubmitForm doctor={me} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Who works here" />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Detail label="Clinicians" value={String(counts.DOCTOR ?? 0)} />
          <Detail label="Administrators" value={String(counts.ADMIN ?? 0)} />
          <Detail label="Desk" value={String(counts.SECRETARY ?? 0)} />
        </dl>
        {waiting > 0 ? (
          <p className="border-t border-border px-5 py-3 text-sm text-ink-muted">
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
      </Card>

      <Card>
        <CardHeader
          title="Schedule"
          subtitle="Opening hours, breaks, closures and how long each visit takes."
          action={
            <Link href="/manage/schedule" className="font-medium text-accent-ink hover:underline">
              Edit
            </Link>
          }
        />
        <p className="px-5 py-4 text-sm">{week ?? "No clinician yet, so no diary to set hours for."}</p>
      </Card>
    </div>
  );
}
