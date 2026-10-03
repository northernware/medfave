import { apiDoctor, apiError, readJson } from "@/lib/api";
import { changeAppointmentStatus } from "@/lib/booking";
import { formatDateTime } from "@/lib/datetime";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/domain";

/**
 * Move a visit through the queue: check in, start, complete, cancel, no-show.
 *
 * Body: `{ status }`. Only a move the visit's `nextStatuses` lists is accepted.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/doctor/appointments/[id]/status">) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body || typeof body.status !== "string") return apiError(400, "Send `{ status }` as JSON.");

  const result = await changeAppointmentStatus(doctor, id, body.status);
  if (result.ok) return Response.json({ id, status: result.status });

  switch (result.reason) {
    case "invalid":
      return apiError(422, "That is not a status.", { status: ["Unknown status"] });
    case "not-found":
      return apiError(404, "No appointment with that id.");
    case "role":
      return apiError(403, "Only a clinician can make that change.");
    case "transition":
      return apiError(
        409,
        `A visit that is ${APPOINTMENT_STATUS_LABELS[result.current].toLowerCase()} can't move to ${
          APPOINTMENT_STATUS_LABELS[body.status as keyof typeof APPOINTMENT_STATUS_LABELS]?.toLowerCase() ?? body.status
        }.`,
      );
    case "clash":
      // Say whose time it is now, so the doctor knows what to do instead.
      return apiError(
        409,
        result.restoring
          ? `Can't put this visit back: ${formatDateTime(result.clashAt)} is ${result.clashWith}'s now. Leave it checked in, or move it to a new time.`
          : `${formatDateTime(result.clashAt)} has been booked for ${result.clashWith} since. Book a new time instead.`,
      );
    case "not-today":
      return apiError(409, "Check in and start a visit on its day.");
  }
}
