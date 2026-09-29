import { googleConfigured } from "@/lib/google";

/** Which sign-in options this server offers, so the app shows only those. */
export async function GET() {
  return Response.json({ google: googleConfigured() });
}
