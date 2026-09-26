import type { Metadata } from "next";
import Link from "next/link";
import {
  changePassword,
  updateAccountDetails,
  updateClinicianProfile,
} from "@/app/actions/account";
import { homeFor, requireViewer } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { AccountDetailsForm, ClinicianProfileForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Your account" };

const SAVED: Record<string, string> = {
  details: "Your details have been updated.",
  password: "Your password has been changed. Any other device you were signed in on has been signed out.",
  clinician: "Your clinician details have been updated.",
};

/**
 * One account page for everybody.
 *
 * A doctor, a secretary and a patient all need the same three things — a name,
 * a sign-in address and a password — so they share a page rather than each
 * getting a variant of it. The only role-dependent part is the clinician
 * block, which exists because a licence number prints on paper.
 */
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const viewer = await requireViewer();
  const { saved } = await searchParams;

  const clinician = viewer.doctorId
    ? await orm.Doctor
        .select("id", "specialty", "licenseNumber")
        .where((d) => d.id.eq(viewer.doctorId!))
        .first()
    : null;

  const role = viewer.staff?.role;
  const standing = role
    ? `${role === "DOCTOR" ? "Doctor" : role === "SECRETARY" ? "Secretary" : "Administrator"} at ${viewer.staff!.clinicName}`
    : viewer.patient
      ? "Patient"
      : "No clinic or record";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your account"
        subtitle={standing}
        actions={
          <Link href={homeFor(viewer)} className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />

      {typeof saved === "string" && SAVED[saved] ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-[13px]">
          <p className="font-medium text-ok-ink">{SAVED[saved]}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Your details"
          subtitle="Your name as it appears to colleagues, and the address you sign in with."
        />
        <div className="px-5 py-4">
          <AccountDetailsForm
            action={updateAccountDetails}
            defaults={{ fullName: viewer.fullName, email: viewer.email }}
          />
        </div>
      </Card>

      {clinician ? (
        <Card>
          <CardHeader
            title="Clinician details"
            subtitle="These print on prescriptions and certificates you sign."
          />
          <div className="px-5 py-4">
            <ClinicianProfileForm
              action={updateClinicianProfile}
              defaults={{
                specialty: clinician.specialty ?? "",
                licenseNumber: clinician.licenseNumber ?? "",
              }}
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Password"
          subtitle="Changing it signs out every other device you are signed in on."
        />
        <div className="px-5 py-4">
          <PasswordForm action={changePassword} />
        </div>
      </Card>
    </div>
  );
}
