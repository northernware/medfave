import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { inviteStaff, removeClinicMember, revokeStaffInvite } from "@/app/actions/access";
import { requireClinicManager } from "@/lib/auth";
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

/** Roles that can administer the clinic. One of them has to remain. */
const MANAGER_ROLES = ["DOCTOR", "ADMIN"];

export default async function StaffPage({ searchParams }: PageProps<"/manage/staff">) {
  const manager = await requireClinicManager();
  // Nobody joins a clinic before its doctor is verified.
  if (!manager.clinicOpen) redirect("/manage");
  const { code, to, mail } = await searchParams;

  const [members, invites] = await Promise.all([
    orm.ClinicMember
      .select("id", "role", "createdAt")
      .include("account", (a) => a.select("id", "email", "fullName"))
      .where((m) => m.clinicId.eq(manager.clinicId))
      .orderBy((m) => m.createdAt.asc())
      .all(),
    orm.StaffInvite
      .select("id", "email", "role", "expiresAt", "acceptedAt", "revokedAt", "createdAt")
      .where((i) => i.clinicId.eq(manager.clinicId))
      .orderBy((i) => i.createdAt.desc())
      .limit(20)
      .all(),
  ]);

  const live = invites.filter((i) => !i.acceptedAt && !i.revokedAt);
  const managers = members.filter((m) => MANAGER_ROLES.includes(m.role));

  /**
   * Whether this membership can be given up.
   *
   * A clinician is never removed here — a clinic with no clinician has records
   * nobody can reach — and the last person who can administer the clinic stays
   * too, or there is no way back in to appoint anyone.
   */
  const removable = (role: string) => {
    if (role === "DOCTOR") return false;
    if (MANAGER_ROLES.includes(role) && managers.length <= 1) return false;
    return true;
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Staff"
        subtitle={`Who works at ${manager.clinicName}, and what they may reach.`}
      />

      {/* The code is shown once to the person who made it, whatever the mail
          did, so an invitation is never lost to a mail problem. */}
      {code ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3">
          <p className="text-sm font-medium text-ok-ink">
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
                <span className="block text-sm font-medium">{m.account.fullName}</span>
                <span className="block truncate text-xs text-ink-muted">{m.account.email}</span>
              </span>
              <Badge tone={MANAGER_ROLES.includes(m.role) ? "accent" : "neutral"}>
                {ROLE_LABELS[m.role] ?? m.role}
              </Badge>
              {removable(m.role) ? (
                <form action={removeClinicMember}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <button className="text-xs font-medium text-ink-muted hover:text-danger-ink">
                    Remove
                  </button>
                </form>
              ) : (
                <span className="text-xs text-ink-faint">
                  {m.role === "DOCTOR" ? "Clinician" : "Last administrator"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Invite somebody"
          subtitle="A secretary registers patients, books and runs the waiting room — never the notes. An administrator runs the clinic: staff and settings, no charts."
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
                  <span className="block text-sm font-medium">{i.email}</span>
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
