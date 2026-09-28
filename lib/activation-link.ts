import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { appUrl } from "@/lib/email";

/**
 * The link a patient opens to activate their login, for a QR code or a
 * message.
 *
 * Built from the address the desk itself is using rather than `APP_URL`: the
 * patient's phone has to be able to open it, and in development `APP_URL` is
 * usually `localhost`, which a phone cannot reach while the desk's own address
 * (the machine's LAN address, or the deployment) can. Falls back to `APP_URL`
 * when there is no request to read it from.
 */
export async function activationLink(code: string) {
  const path = `/register?code=${encodeURIComponent(code)}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return appUrl(path);
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || /^\d/.test(host) ? "http" : "https");
  return `${proto}://${host}${path}`;
}

/**
 * A QR code as inline SVG. Always dark on white whatever the theme: a phone
 * camera reads a light code on a dark ground badly, or not at all.
 */
export function qrSvg(text: string) {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#32132c", light: "#ffffff" },
  });
}
