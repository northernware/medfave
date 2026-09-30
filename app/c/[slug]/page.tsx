import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { buttonClass, Card } from "@/components/ui";
import { clinicBySlug } from "@/lib/discovery";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await clinicBySlug(slug);
  return { title: found ? found.clinic.name : "Clinic" };
}

/**
 * A clinic's public page, from its link or QR code: who practises there, and a
 * way into the Medfave app to ask for a visit. Nothing clinical, nothing about
 * any patient.
 */
export default async function ClinicLinkPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const found = await clinicBySlug(slug);
  if (!found) notFound();
  const { clinic, doctors } = found;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">
      <Brand />
      <div>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">{clinic.name}</h1>
        {clinic.address ? <p className="mt-1 text-ink-muted">{clinic.address}</p> : null}
        {clinic.contactNumber ? <p className="text-ink-muted">{clinic.contactNumber}</p> : null}
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {doctors.map((d) => (
            <li key={d.id} className="px-5 py-3">
              <p className="font-medium">{d.fullName}</p>
              {d.specialty ? <p className="text-sm text-ink-muted">{d.specialty}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-3">
        <a href={`medfave://clinic/${clinic.slug}`} className={buttonClass("primary", "w-full py-3")}>
          Open in the Medfave app
        </a>
        <Link href="/signup" className={buttonClass("secondary", "w-full py-3")}>
          New to Medfave? Create an account
        </Link>
        <p className="text-center text-sm text-ink-muted">
          Ask for a visit in the app. The clinic confirms your time.
        </p>
      </div>
    </div>
  );
}
