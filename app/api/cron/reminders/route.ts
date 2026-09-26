import { orm } from "@/src/prisma/db";
import { sendDueReminders } from "@/lib/reminders";

/**
 * Sends tomorrow's reminders for every clinic, on a schedule.
 *
 * The sweep also runs when the clinic's own screens are read, which covers a
 * practice that is opened every day. This exists for the one that is not —
 * point a cron at it (Vercel Cron, GitHub Actions, a crontab with curl) once
 * each afternoon.
 *
 * Guarded by a shared secret rather than a session, because a scheduler has no
 * session. Without CRON_SECRET set the route refuses outright rather than
 * running open to the world: an endpoint that mails every patient in the
 * database is not one to leave unlocked by default.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 },
    );
  }

  // Bearer token or `?key=`, since not every scheduler can set headers.
  const header = request.headers.get("authorization");
  const url = new URL(request.url);
  const offered = header?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key") ?? "";
  if (offered !== secret) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  const now = new Date();
  const clinics = await orm.Clinic.select("id", "name").all();

  const results = [];
  for (const clinic of clinics) {
    const summary = await sendDueReminders(clinic.id, now);
    results.push({ clinic: clinic.name, ...summary });
  }

  return Response.json({ ranAt: now.toISOString(), clinics: results });
}
