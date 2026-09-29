import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui";
import { AddClinicForm } from "@/app/(portal)/portal/add-clinic/add-clinic-form";
import { PracticeForm } from "./practice-form";
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
          {doctor ? "Let's get your practice onto Medfave." : "Let's connect you with your clinic."}
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

      {viewer.staff ? (
        <Card>
          <CardHeader title={viewer.staff.clinicName} subtitle="Not open yet" />
          <p className="px-5 pb-5 text-sm text-ink-muted">
            This clinic&rsquo;s doctor is waiting for us to check their PRC licence. You&rsquo;ll have everything as soon
            as it&rsquo;s verified.
          </p>
        </Card>
      ) : doctor ? (
        <Card>
          <CardHeader
            title="Set up your practice"
            subtitle="We check your PRC licence before your clinic can see patients — that keeps Medfave for real doctors only. Usually within a day."
          />
          <PracticeForm name={viewer.fullName} />
          <p className="px-5 pb-5 text-sm text-ink-muted">
            Joining a clinic that&rsquo;s already on Medfave? Ask them to invite you instead.
          </p>
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
