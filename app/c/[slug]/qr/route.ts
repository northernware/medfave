import QRCode from "qrcode";
import { clinicBySlug } from "@/lib/discovery";
import { appUrl } from "@/lib/email";

/**
 * The clinic's QR code, as a PNG: it opens the clinic's page
 * (`/c/<slug>`). Public, like the page itself — it names the clinic and its
 * doctors, nothing about any patient.
 */
export async function GET(_request: Request, ctx: RouteContext<"/c/[slug]/qr">) {
  const { slug } = await ctx.params;
  const found = await clinicBySlug(slug);
  if (!found) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(appUrl(`/c/${found.clinic.slug}`), {
    width: 900,
    margin: 2,
    errorCorrectionLevel: "M",
    // Deep plum on white: the brand's text colour, and a contrast any phone camera reads.
    color: { dark: "#32132C", light: "#FFFFFF" },
  });
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
  });
}
