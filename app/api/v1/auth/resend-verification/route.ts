import { apiError, apiViewer } from "@/lib/api";
import { hit, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { sendVerification } from "@/lib/sign-up";

/** Sends a fresh verification link to the signed-in account's email. */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (viewer.emailVerified) return Response.json({ sent: false, alreadyVerified: true });
  if (!(await hit(`email-send:${viewer.email}`, LIMITS.emailSends))) return apiError(429, TOO_MANY);
  await sendVerification(viewer.accountId);
  return Response.json({ sent: true });
}
