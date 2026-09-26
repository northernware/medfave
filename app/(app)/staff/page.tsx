import type { Metadata } from "next";
import { inviteStaff, removeClinicMember, revokeStaffInvite } from "@/app/actions/access";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { formatDateTime, instantFromDb } from "@/lib/datetime";
import { Badge, Card, CardHeader, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { InviteStaffForm } from "./invite-form";

export const metadata: Metadata = { title: "Staff" };

const ROLE_LABELS: Record<string, string> = {
  DOCTOR: "Doctor",
  SECRETARY: "Secretary",
  ADMIN: "Administrator",
};

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const doctor = await requireDoctor();
  const { code, to, mail } = await searchParams;

  const [members, invites] = await Promise.all([
    orm.ClinicMember
      .select("id", "role", "createdAt")
      .include("account", (a) => a.select("id", "email", "fullName"))
      .where((m) => m.clinicId.eq(doctor.clinicId))
      .orderBy((m) => m.createdAt.asc())
      .all(),
    orm.StaffInvite
      .select("id", "email", "role", "expiresAt", "acceptedAt", "revokedAt", "createdAt")
      .where((i) => i.clinicId.eq(doctor.clinicId))
      .orderBy((i) => i.createdAt.desc())
      .limit(20)
      .all(),
  ]);

  const live = invites.filter((i) => !i.acceptedAt && !i.revokedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle={`Who works at ${doctor.clinicName ?? "this clinic"}, and what they may reach.`}
      />

      {/* No mail is sent from this application yet, so the code is shown once
          to the person who made it, to pass on however they normally would. */}
      {code ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3">
          <p className="text-[13px] font-medium text-ok-ink">
            Invitation for {to} — copy it now, it is not shown again.
          </p>
          <p className="tabular mt-1 text-lg font-semibold tracking-wider">{code}</p>
          <p className="mt-1 text-xs text-ink-muted">
            They enter it at <strong>/invite</strong>. It is valid for seven days and can only be
            used once.{" "}
            {mail === "sent" ? (
            <>Also emailed to that address.</>
          ) : mail === "failed" ? (
            <>The email could not be sent, so this code is the only copy — pass it on directly.</>
          ) : mail === "no-address" ? (
            <>No email address on file, so this code is the only copy.</>
          ) : (
            <>Email is not set up, so this code is the only copy.</>
          )}
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Members" />
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{m.account.fullName}</span>
                <span className="block truncate text-xs text-ink-muted">{m.account.email}</span>
              </span>
              <Badge tone={m.role === "DOCTOR" ? "accent" : "neutral"}>
                {ROLE_LABELS[m.role] ?? m.role}
              </Badge>
              {/* A clinic that can be left with nobody clinical in it is a
                  clinic whose records nobody can reach, so only the desk can
                  be removed here. */}
              {m.role === "SECRETARY" ? (
                <form action={removeClinicMember}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <button className="text-xs font-medium text-ink-muted hover:text-danger-ink">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Invite a secretary"
          subtitle="They can register patients, book, and run the waiting room — never the notes."
        />
        <div className="px-5 py-4">
          <InviteStaffForm action={inviteStaff} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Outstanding invitations" />
        {live.length === 0 ? (
          <EmptyState title="None waiting" description="Every invitation has been used or expired." />
        ) : (
          <ul className="divide-y divide-border">
            {live.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{i.email}</span>
                  <span className="block text-xs text-ink-muted">
                    {ROLE_LABELS[i.role]} · expires {formatDateTime(instantFromDb(i.expiresAt))}
                  </span>
                </span>
                <form action={revokeStaffInvite}>
                  <input type="hidden" name="inviteId" value={i.id} />
                  <button className={buttonClass("secondary")}>Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
