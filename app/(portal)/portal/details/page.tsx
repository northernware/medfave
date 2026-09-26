import type { Metadata } from "next";
import Link from "next/link";
import { updatePatientContact } from "@/app/actions/account";
import { requirePatientAccount } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/datetime";
import { fullName, SEX_LABELS } from "@/lib/domain";
import { buttonClass, Card, CardHeader, Detail, PageHeader } from "@/components/ui";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Your details" };

/**
 * What a patient may change about themselves, and what they may not.
 *
 * Both halves are on one page on purpose. The fields the clinic maintains are
 * shown here rather than hidden, so "you cannot edit this" is visible as a
 * decision with a reason beside it, instead of appearing as an omission.
 */
export default async function PortalDetailsPage({ searchParams }: PageProps<"/portal/details">) {
  const me = await requirePatientAccount();
  const { saved } = await searchParams;

  const profile = await orm.Patient
    .select(
      "id",
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "sex",
      "patientNumber",
      "contactNumber",
      "email",
      "reminderPreference",
    )
    .include("household", (h) => h.select("name"))
    .where((p) => p.id.eq(me.patientId))
    .first();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your details"
        subtitle="Keep your contact details right and the clinic can reach you."
        actions={
          <Link href="/portal" className={buttonClass("secondary")}>
            Back
          </Link>
        }
      />

      {saved === "contact" ? (
        <div className="rounded-lg border border-ok/40 bg-ok-tint px-4 py-3 text-[13px]">
          <p className="font-medium text-ok-ink">
            Your contact details have been updated. The clinic sees the change straight away, and
            the visits already in your diary follow your reminder choice.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="How to reach you"
          subtitle="Yours to correct, including whether the clinic writes to you at all."
        />
        <div className="px-5 py-4">
          <ContactForm
            action={updatePatientContact}
            defaults={{
              contactNumber: profile.contactNumber ?? "",
              email: profile.email ?? "",
              reminderPreference: profile.reminderPreference,
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Held by the clinic"
          subtitle="Your record has to say who it is about, so these are changed at the clinic rather than here. Ask at the desk if something is wrong."
        />
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Detail label="Name" value={fullName(profile)} />
          <Detail
            label="Date of birth"
            value={formatCalendarDate(calendarDateFromDb(profile.dateOfBirth))}
          />
          <Detail label="Sex" value={SEX_LABELS[profile.sex]} />
          <Detail label="Household" value={profile.household.name} />
          <Detail label="Patient number" value={profile.patientNumber} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Signing in"
          subtitle="Your password and the address you sign in with are separate from the details above."
        />
        <div className="px-5 py-4">
          <Link href="/account" className={buttonClass("secondary")}>
            Account and password
          </Link>
        </div>
      </Card>
    </div>
  );
}
