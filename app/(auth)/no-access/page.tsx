import type { Metadata } from "next";
import { logout } from "@/app/actions/auth";
import { requireViewer } from "@/lib/auth";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Nothing to show" };

/**
 * Signed in, but connected to nothing.
 *
 * An account with no clinic membership and no chart is not an error — it is
 * what an invitation that was revoked, or an activation that never happened,
 * leaves behind. Saying so plainly beats a redirect loop between doors that all
 * turn the visitor away.
 */
export default async function NoAccessPage() {
  const viewer = await requireViewer();

  return (
    <div className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Nothing to show yet</h1>
      <p className="mt-2 text-sm text-ink-muted">
        You are signed in as <strong>{viewer.email}</strong>, but this account is not connected to a
        clinic or to a patient record.
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        If you are a patient, the clinic can give you an activation code. If you are staff, ask a
        doctor at your clinic to send you an invitation.
      </p>
      <form action={logout} className="mt-6">
        <button className={buttonClass("secondary")}>Sign out</button>
      </form>
    </div>
  );
}
