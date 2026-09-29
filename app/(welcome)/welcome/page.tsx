import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui";
import { AddClinicForm } from "@/app/(portal)/portal/add-clinic/add-clinic-form";
import { ResendVerification } from "./resend-verification";

export const metadata: Metadata = { title: "Welcome" };

/** What a new account can do next, depending on what they signed up as. */
export default async function WelcomePage() {
  const viewer = await requireViewer();
  const firstName = viewer.fullName.split(/\s+/)[0];
  const doctor = viewer.signupRole === "DOCTOR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Welcome, {firstName}</h1>
        <p className="mt-1 text-ink-muted">
          {doctor ? "Let's get your practice onto medfave." : "Let's connect you with your clinic."}
        </p>
      </div>

      {viewer.emailVerified ? null : (
        <Card>
          <div className="space-y-3 p-5">
            <p className="font-medium">Confirm your email</p>
            <p className="text-sm text-ink-muted">
              We sent a link to <strong>{viewer.email}</strong>. Open it to confirm this address is yours.
            </p>
            <ResendVerification />
          </div>
        </Card>
      )}

      {doctor ? (
        <Card>
          <CardHeader title="Set up your clinic" subtitle="Coming very soon" />
          <div className="space-y-2 px-5 pb-5 text-sm text-ink-muted">
            <p>
              Next, you&rsquo;ll add your PRC licence number and create your clinic. We check the licence before your
              clinic can see patients — that keeps Medfave for real doctors only.
            </p>
            <p>We&rsquo;ll email you when clinic setup opens. Already work at a clinic on Medfave? Ask them to invite you.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Have a code from your clinic?"
            subtitle="Clinics on Medfave give their patients an activation code — at the desk, or by message."
          />
          <AddClinicForm />
          <p className="px-5 pb-5 text-sm text-ink-muted">
            No code? Finding a clinic and asking for a visit on Medfave is coming soon.
          </p>
        </Card>
      )}
    </div>
  );
}
