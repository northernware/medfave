import type { Metadata } from "next";
import Link from "next/link";
import { requireClinicManager } from "@/lib/auth";
import { weekLines } from "@/lib/availability";
import { clinicDoctorId } from "@/lib/clinic";
import { loadSchedule } from "@/lib/queries";
import { orm } from "@/src/prisma/db";
import { Card, CardHeader, Detail, PageHeader, buttonClass } from "@/components/ui";
import { VerificationTracker } from "@/components/verification-tracker";
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
    ? await orm.Doctor.select("fullName", "licenseNumber", "specialty", "verificationStatus", "declineReason")
        .where((d) => d.id.eq(manager.doctorId!))
        .first()
    : null;

  const [clinic, members, liveInvites] = await Promise.all([
    orm.Clinic.select("id", "name", "address", "contactNumber")
      .where((c) => c.id.eq(manager.clinicId))
      .first(),
    orm.ClinicMember.select("id", "role")
      .where((m) => m.clinicId.eq(manager.clinicId))
      .all(),
    orm.StaffInvite.select("id", "acceptedAt", "revokedAt")
      .where((i) => i.clinicId.eq(manager.clinicId))
      .all(),
  ]);

  const counts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const outstanding = liveInvites.filter((i) => !i.acceptedAt && !i.revokedAt).length;
  const doctorId = await clinicDoctorId(manager.clinicId);
  const week = doctorId ? weekLines(await loadSchedule(doctorId)) : null;
  const waiting = me && me.verificationStatus !== "VERIFIED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={clinic?.name ?? manager.clinicName}
        subtitle={
          waiting
            ? "Your clinic isn't open to patients yet."
            : `You are signed in as ${ROLE_WORDS[manager.role] ?? "staff"}.`
        }
        actions={
          manager.clinicOpen ? (
            <Link href="/manage/staff" className={buttonClass("primary")}>
              Staff
            </Link>
          ) : null
        }
      />

      {me && me.verificationStatus === "PENDING" ? (
        <Card raised>
          <div className="space-y-5 p-5 sm:p-6">
            <VerificationTracker status="PENDING" />
            <div>
              <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">
                {welcome ? "Your clinic is set up. Now we check your license." : "We're checking your license"}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-ink-muted">
                PRC license <strong className="nums text-ink">{me.licenseNumber}</strong> for{" "}
                <strong className="text-ink">{me.fullName}</strong>. Usually within a day — we&rsquo;ll email you. Until
                then you can&rsquo;t add patients, book visits or invite staff.
              </p>
            </div>
            <div className="rounded-md bg-surface-muted p-4">
              <p className="text-sm font-semibold">While you wait</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>
                  <Link href="/manage/schedule" className="font-medium text-accent-ink hover:underline">
                    Set your opening hours and services →
                  </Link>
                </li>
                <li>
                  <Link href="/manage/clinic" className="font-medium text-accent-ink hover:underline">
                    Check your clinic&rsquo;s name, address and phone →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      {me && me.verificationStatus === "DECLINED" ? (
        <Card raised>
          <div className="space-y-5 p-5 sm:p-6">
            <VerificationTracker status="DECLINED" />
            <div>
              <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">
                We couldn&rsquo;t verify your license yet
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">Fix the details below and send them again.</p>
            </div>
            <div
              role="note"
              className="rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-ink"
            >
              <p className="font-semibold">Why</p>
              <p className="mt-0.5">{me.declineReason}</p>
            </div>
            <ResubmitForm doctor={me} />
          </div>
        </Card>
      ) : null}

      {waiting ? null : (
        <Card>
          <CardHeader title="Who works here" />
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <Detail label="Clinicians" value={String(counts.DOCTOR ?? 0)} />
            <Detail label="Administrators" value={String(counts.ADMIN ?? 0)} />
            <Detail label="Desk" value={String(counts.SECRETARY ?? 0)} />
          </dl>
          {outstanding > 0 ? (
            <p className="border-t border-border px-5 py-3 text-sm text-ink-muted">
              {outstanding === 1 ? "One invitation is" : `${outstanding} invitations are`} still outstanding.{" "}
              <Link href="/manage/staff" className="font-medium text-accent-ink hover:underline">
                See them
              </Link>
            </p>
          ) : null}
        </Card>
      )}

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
        {week ? (
          <ul className="space-y-1 px-5 py-4 text-sm">
            {week.length ? week.map((line) => <li key={line}>{line}</li>) : <li>No opening hours set</li>}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm">No clinician yet, so no diary to set hours for.</p>
        )}
      </Card>
    </div>
  );
}
