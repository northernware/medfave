import type { Metadata } from "next";
import Link from "next/link";
import { setCancelHours, setListed, setSharedCharts, updateClinicDetails } from "@/app/actions/clinic";
import { ensureSlug } from "@/lib/clinic-link";
import { appUrl } from "@/lib/email";
import { sharesCharts } from "@/lib/care";
import { orm } from "@/src/prisma/db";
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
  const slug = await ensureSlug(manager.clinicId);
  const link = appUrl(`/c/${slug}`);
  const [listing] = await Promise.all([
    orm.Clinic.select("listed", "patientCancelHours").where((c) => c.id.eq(manager.clinicId)).first(),
  ]);
  const [shared, doctorCount] = await Promise.all([
    sharesCharts(manager.clinicId),
    orm.Doctor.where((d) => d.clinicId.eq(manager.clinicId)).aggregate((a) => ({ n: a.count() })),
  ]);

  return (
    <div className="space-y-3">
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
            {saved === "listing"
              ? listing?.listed
                ? "Your clinic now appears in Find a doctor."
                : "Your clinic is no longer listed. Its link still works."
              : saved === "cancel"
              ? `Patients can cancel up to ${listing?.patientCancelHours ?? 2} hour${listing?.patientCancelHours === 1 ? "" : "s"} before a visit.`
              : saved === "sharing"
              ? shared
                ? "Charts are now shared between this clinic's doctors."
                : "Charts are private again: each doctor reads only their own patients' charts."
              : "Saved. New prescriptions, certificates and emails use these details from now on."}
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Invite patients" subtitle="Your clinic's QR code and link. Patients scan it to ask for a visit." />
        <div className="grid gap-5 px-5 py-4 text-sm sm:grid-cols-[auto_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/c/${slug}/qr`} alt="Your clinic's QR code" className="size-40 rounded-lg border border-border bg-white p-2" />
          <div className="space-y-3">
            <p className="break-all rounded-md bg-surface-muted px-3 py-2 font-mono text-xs">{link}</p>
            <p className="text-ink-muted">Post it on Facebook, send it in Messenger, or print it for the door and the desk.</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/c/${slug}/poster`} target="_blank" className={buttonClass("primary")}>
                Print poster
              </a>
              <a href={`/c/${slug}/qr`} download={`${slug}-qr.png`} className={buttonClass("secondary")}>
                Download QR
              </a>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Find a doctor" subtitle="Whether patients can find your clinic in the Medfave app's search." />
        <form action={setListed} className="space-y-3 px-5 py-4 text-sm">
          <label className="flex gap-3">
            <input type="checkbox" name="listed" defaultChecked={listing?.listed ?? false} className="mt-0.5 size-4 accent-accent" />
            <span>
              <span className="block font-medium">List us in &ldquo;Find a doctor&rdquo;</span>
              <span className="block text-ink-muted">
                Patients can find your verified doctors by name, specialty or town and send a request. You still
                confirm every visit. Your link and QR work either way.
              </span>
            </span>
          </label>
          <button className={buttonClass("secondary")}>Save listing</button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Cancelling" subtitle="Patients can cancel a visit themselves in the app until this many hours before it." />
        <form action={setCancelHours} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
          <select
            name="hours"
            defaultValue={String(listing?.patientCancelHours ?? 2)}
            className="rounded-md border border-border-strong bg-surface px-3 py-2"
            aria-label="Hours before the visit"
          >
            {[0, 1, 2, 3, 4, 6, 12, 24, 48].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Right up to the visit" : `${h} hour${h === 1 ? "" : "s"} before`}
              </option>
            ))}
          </select>
          <button className={buttonClass("secondary")}>Save</button>
          <span className="basis-full text-ink-muted">After that they call you. Moving a visit is always a request you accept.</span>
        </form>
      </Card>

      {doctorCount.n > 1 ? (
        <Card>
          <CardHeader
            title="Sharing charts"
            subtitle="Whether this clinic's doctors can read each other's patients' charts."
          />
          <form action={setSharedCharts} className="space-y-3 px-5 py-4 text-sm">
            <label className="flex gap-3">
              <input type="checkbox" name="sharedCharts" defaultChecked={shared} className="mt-0.5 size-4 accent-accent" />
              <span>
                <span className="block font-medium">Share charts between this clinic&rsquo;s doctors</span>
                <span className="block text-ink-muted">
                  Any doctor here can read any patient&rsquo;s allergies, conditions, medications, alerts and visit
                  notes — useful when doctors cover for each other. Notes can still only be changed by the doctor who
                  wrote them. Off: each doctor reads only the charts of patients they care for.
                </span>
              </span>
            </label>
            <p className="text-ink-muted">
              Every time a chart or note is opened it&rsquo;s logged, and the patient&rsquo;s doctors can see who
              looked. Patients are told in the privacy notice that doctors at a clinic that shares charts may see
              their records.
            </p>
            <button className={buttonClass("secondary")}>Save sharing</button>
          </form>
        </Card>
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
