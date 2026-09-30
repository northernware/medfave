import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeartMark } from "@/components/brand";
import { clinicBySlug } from "@/lib/discovery";
import { appUrl } from "@/lib/email";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/c/[slug]/poster">): Promise<Metadata> {
  const { slug } = await params;
  const found = await clinicBySlug(slug);
  return { title: found ? `${found.clinic.name} — QR poster` : "QR poster" };
}

/**
 * A printable poster of the clinic's QR code, for the door or the desk: scan
 * it to find the clinic in Medfave and ask for a visit. Always light, so it
 * prints the same whatever the viewer's theme.
 */
export default async function PosterPage({ params }: PageProps<"/c/[slug]/poster">) {
  const { slug } = await params;
  const found = await clinicBySlug(slug);
  if (!found) notFound();
  const { clinic } = found;
  const link = appUrl(`/c/${clinic.slug}`);

  return (
    <div
      className="min-h-dvh bg-white px-4 py-8 text-[#32132C] print:p-0"
      // The poster is always the light logo, whatever the viewer's theme.
      style={{ "--logo-heart": "#E91E83", "--logo-word": "#32132C" } as React.CSSProperties}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-3xl border-2 border-[#E91E83] p-8 text-center print:border-0">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <HeartMark className="size-7" /> Medfave
        </div>
        <h1 className="text-3xl leading-tight font-semibold">{clinic.name}</h1>
        {clinic.address ? <p className="text-sm">{clinic.address}</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/c/${clinic.slug}/qr`} alt={`QR code for ${clinic.name}`} className="size-72" />
        <p className="text-xl font-semibold">Scan to ask for a visit</p>
        <p className="text-sm">Open your phone camera, point it here, and send your request in the Medfave app.</p>
        <p className="font-mono text-xs break-all">{link}</p>
      </div>
      <div className="mt-6 text-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
