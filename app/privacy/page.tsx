import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { PRIVACY_NOTICE_VERSION } from "@/lib/sign-up";

export const metadata: Metadata = { title: "Privacy notice" };

/**
 * DRAFT — to be reviewed by a lawyer before launch. Written to cover what the
 * Data Privacy Act of 2012 (RA 10173) asks a notice to say. When it changes,
 * bump PRIVACY_NOTICE_VERSION in lib/sign-up.ts so new consents record it.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Brand />
      <article className="mt-8 space-y-5 text-base leading-7 text-ink-muted [&_h1]:text-ink [&_h2]:text-ink [&_strong]:text-ink">
        <p className="rounded-md bg-warn-tint px-3 py-2 text-sm text-warn-ink">
          Draft for review. Version {PRIVACY_NOTICE_VERSION}.
        </p>
        <h1 className="text-[32px] leading-10 font-semibold">Privacy notice</h1>
        <p>
          Medfave is software that clinics use to run appointments and patient records, and that patients use to see
          their visits and reach their clinic. This notice explains what we collect, why, and your rights.
        </p>

        <h2 className="text-xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Your account:</strong> name, email, password (stored only as a one-way hash), and whether you signed up as a patient or a doctor.</li>
          <li><strong>From your clinic:</strong> the records a clinic keeps about you as its patient — contact details, appointments, visit notes, prescriptions and documents. Each clinic keeps its own; one clinic never sees another&rsquo;s.</li>
          <li><strong>For doctors:</strong> your PRC license number, to check you are licensed before your clinic can see patients.</li>
          <li><strong>Technical:</strong> sign-in times and network addresses, used to keep accounts secure and to stop repeated sign-in attempts.</li>
        </ul>

        <h2 className="text-xl font-semibold">Why</h2>
        <p>
          To let you and your clinic book visits, keep records, and reach each other; to keep your account secure; and to
          meet our legal duties. Health information is sensitive personal information under the Data Privacy Act, so we
          process it only with your consent or as the law allows.
        </p>

        <h2 className="text-xl font-semibold">Who sees it</h2>
        <p>
          Your records are seen by the clinic that keeps them and the people it authorises. We don&rsquo;t sell your
          information or use it for advertising. Service providers that host Medfave or send its emails process data only
          on our instructions.
        </p>

        <h2 className="text-xl font-semibold">Your rights</h2>
        <p>
          You can ask to be informed, to access and correct your information, to object, and to have it erased or blocked
          where the law allows, and you can complain to the National Privacy Commission. Records a clinic must keep by law
          stay with that clinic.
        </p>

        <h2 className="text-xl font-semibold">Contact</h2>
        <p>Data protection officer: [NAME, EMAIL — to be filled in before launch].</p>

        <p className="pt-4 text-sm">
          <Link href="/signup" className="font-medium text-accent-ink hover:underline">Back to sign-up</Link>
        </p>
      </article>
    </div>
  );
}
