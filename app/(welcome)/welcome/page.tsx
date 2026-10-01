import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { Card, CardHeader } from "@/components/ui";
import { FindDoctor } from "@/components/find-doctor";
import { AddClinicForm } from "@/app/(portal)/portal/add-clinic/add-clinic-form";
import { PracticeForm } from "./practice-form";
import { ResendVerification } from "./resend-verification";

export const metadata: Metadata = { title: "Welcome" };

/** What a new account can do next, depending on what they signed up as. */
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { q, code } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const initialCode = typeof code === "string" ? code : "";
  const viewer = await requireViewer();
  const firstName = viewer.fullName.split(/\s+/)[0];
  const doctor = viewer.signupRole === "DOCTOR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">Welcome, {firstName}</h1>
        <p className="mt-1 text-ink-muted">
          {doctor ? "Let's get your practice onto Medfave." : "Find a doctor, or connect the clinic you already go to."}
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
            This clinic&rsquo;s doctor is waiting for us to check their PRC license. You&rsquo;ll have everything as soon
            as it&rsquo;s verified.
          </p>
        </Card>
      ) : doctor ? (
        <Card>
          <CardHeader
            title="Set up your practice"
            subtitle="We check your PRC license before your clinic can see patients — that keeps Medfave for real doctors only. Usually within a day."
          />
          <PracticeForm name={viewer.fullName} />
          <p className="border-t border-border px-5 py-4 text-sm text-ink-muted sm:px-6">
            Joining a clinic that&rsquo;s already on Medfave? Ask them to invite you instead.
          </p>
        </Card>
      ) : (
        <>
          <FindDoctor q={query} action="/welcome" />
          {/* Patients the clinic already keeps records for link with its code. */}
          <details open={Boolean(initialCode)} className="group rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium">
              Have a code from your clinic?{" "}
              <span className="text-ink-muted group-open:hidden">Enter it here</span>
            </summary>
            <p className="px-5 text-sm text-ink-muted">It links this account to the records the clinic already keeps for you.</p>
            <AddClinicForm code={initialCode} email={viewer.email} />
          </details>
        </>
      )}
    </div>
  );
}
