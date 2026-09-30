import "server-only";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { appUrl, sendStaffInvite } from "@/lib/email";
import { newId } from "@/lib/ids";
import { issueToken } from "@/lib/tokens";
import type { FormState } from "@/lib/validation";

/*
 * Inviting somebody to work at the clinic, shared by the web's Staff page
 * (app/actions/access.ts) and the app's API. The role is fixed on the
 * invitation; a doctor joins pending and is verified like any other.
 */

const INVITE_DAYS = 7;
const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

export type InviteResult = { ok: true; code: string; mail: "sent" | "off" | "failed" } | ({ ok: false } & FormState);

export async function createStaffInvite(
  manager: { clinicId: string; clinicName: string; accountId: string; fullName: string; clinicOpen: boolean },
  input: { email?: unknown; role?: unknown },
): Promise<InviteResult> {
  if (!manager.clinicOpen) {
    return { ok: false, message: "You can invite staff once your license is verified." };
  }

  const email = String(input.email ?? "").trim().toLowerCase();
  const rawRole = String(input.role ?? "SECRETARY");
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter the address to send it to.", fieldErrors: { email: ["Not an email address"] } };
  }
  if (rawRole !== "SECRETARY" && rawRole !== "ADMIN" && rawRole !== "DOCTOR") {
    return { ok: false, message: "Invite a doctor, a secretary or an administrator.", fieldErrors: { role: ["Not a role"] } };
  }
  const role = rawRole;

  const already = await orm.ClinicMember
    .select("id")
    .include("account", (a) => a.select("email"))
    .where((m) => m.clinicId.eq(manager.clinicId))
    .where((m) => m.account.some((a) => a.email.eq(email)))
    .first();
  if (already) return { ok: false, message: "That person is already a member of this clinic." };

  const now = instantToDb(new Date());
  const { token, hash } = issueToken();

  await orm.StaffInvite.create({
    id: newId(),
    clinicId: manager.clinicId,
    email,
    role,
    tokenHash: hash,
    invitedById: manager.accountId,
    expiresAt: instantToDb(days(INVITE_DAYS)),
    createdAt: now,
  });

  const outcome = await sendStaffInvite({
    to: email,
    clinicName: manager.clinicName,
    invitedBy: manager.fullName,
    role: role === "ADMIN" ? "administrator" : role === "DOCTOR" ? "doctor" : "secretary",
    code: token,
    link: appUrl(`/invite?code=${encodeURIComponent(token)}`),
  });
  const mail = outcome.sent ? "sent" : outcome.reason === "not-configured" ? "off" : "failed";

  return { ok: true, code: token, mail };
}
