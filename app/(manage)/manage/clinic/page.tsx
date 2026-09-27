import type { Metadata } from "next";
import Link from "next/link";
import { updateClinicDetails } from "@/app/actions/clinic";
import { requireClinicManager } from "@/lib/auth";
import { clinicLetterhead } from "@/lib/clinic";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { ClinicDetailsForm } from "./clinic-form";

export const metadata: Metadata = { title: "Clinic details" };

/**
 * What the practice is called and where it is.
 *
 * The preview below the form is the letterhead as it prints, so a change can be
 * checked before anybody hands a patient a certificate with it on.
 */
export default async function ClinicDetailsPage({ searchParams }: PageProps<"/manage/clinic">) {
  const manager = await requireClinicManager();
  const { saved } = await searchParams;
  const clinic = await clinicLetterhead(manager.clinicId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinic details"
        subtitle="The one place the clinic's name is kept. Every letterhead and email reads it from here."
        actions={
          <Link href="/manage" className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />

      {saved ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-sm">
          <p className="font-medium text-ok-ink">
            Saved. New prescriptions, certificates and emails use these details from now on.
          </p>
        </div>
      ) : null}

      <Card>
        <div className="px-5 py-4">
          <ClinicDetailsForm
            action={updateClinicDetails}
            defaults={{
              name: clinic.name,
              address: clinic.address ?? "",
              contactNumber: clinic.contactNumber ?? "",
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="On paper"
          subtitle="How the top of a certificate reads with the details as saved."
        />
        <div className="px-5 py-6">
          <div className="mx-auto max-w-md border-b-2 border-ink pb-3 text-center">
            <p className="text-base font-semibold">{clinic.name}</p>
            {clinic.address ? <p className="text-sm">{clinic.address}</p> : null}
            {clinic.contactNumber ? <p className="text-sm">Tel. {clinic.contactNumber}</p> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
