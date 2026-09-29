import type { Metadata } from "next";
import Link from "next/link";
import { acceptRequest, declineRequest } from "@/app/actions/requests";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Booking requests" };

export default async function DeskRequestsPage({ searchParams }: PageProps<"/desk/requests">) {
  const staff = await requireStaff();
  const { refused, needs } = await searchParams;

  const [pending, decided] = await Promise.all([
    orm.AppointmentRequest
      .select("id", "preferredDate", "preferredTime", "service", "reason", "createdAt")
      .include("doctor", (d) => d.select("fullName"))
      .include("patient", (p) =>
        p.select("id", "firstName", "middleName", "lastName", "contactNumber", "patientNumber"),
      )
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.eq("PENDING"))
      .orderBy((r) => r.createdAt.asc())
      .all(),
    orm.AppointmentRequest
      .select("id", "preferredDate", "preferredTime", "service", "status", "decisionNote", "decidedAt", "appointmentId")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.in(["ACCEPTED", "DECLINED", "WITHDRAWN"]))
      .orderBy((r) => r.updatedAt.desc())
      .limit(15)
      .all(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking requests"
        subtitle="Asked for by patients. Nothing is held until you accept one."
      />

      {refused ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <p className="font-medium text-danger-ink">That request could not be booked.</p>
          <p className="mt-0.5 text-ink-muted">{refused}</p>
        </div>
      ) : null}
      {needs === "time" ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <p className="font-medium text-danger-ink">Give it a time.</p>
          <p className="mt-0.5 text-ink-muted">
            The patient asked for a day without naming an hour, so one has to be chosen here.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Waiting on an answer"
          subtitle="A request holds no slot — the time can go to somebody else until it is accepted."
        />
        {pending.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="No patient is waiting on a reply." />
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <Link
                      href={`/desk/patients/${r.patient.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {fullName(r.patient)}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {r.doctor ? <span className="font-medium text-ink">For {r.doctor.fullName} · </span> : null}
                      {SERVICE_LABELS[r.service]} · {r.reason}
                    </p>
                    <p className="text-xs text-ink-faint">
                      Asked {formatDateTime(instantFromDb(r.createdAt))}
                      {r.patient.contactNumber ? ` · ${r.patient.contactNumber}` : ""}
                    </p>
                  </div>
                  <p className="tabular text-sm">
                    {formatCalendarDate(calendarDateFromDb(r.preferredDate))}
                    {r.preferredTime ? ` at ${r.preferredTime}` : " · any time"}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <form action={acceptRequest} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Time</span>
                      <input
                        name="time"
                        defaultValue={r.preferredTime ?? ""}
                        placeholder="09:30"
                        className="tabular w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <button className={buttonClass("primary")}>Accept and book</button>
                  </form>

                  <form action={declineRequest} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <label className="min-w-48 flex-1 text-sm">
                      <span className="mb-1 block font-medium">Reason, if declining</span>
                      <input
                        name="decisionNote"
                        placeholder="Fully booked that week"
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <button className={buttonClass("secondary")}>Decline</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {decided.length > 0 ? (
        <Card>
          <CardHeader title="Recently answered" />
          <ul className="divide-y divide-border">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {fullName(r.patient)}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {SERVICE_LABELS[r.service]} ·{" "}
                    {formatCalendarDate(calendarDateFromDb(r.preferredDate))}
                    {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </span>
                </span>
                {r.status === "ACCEPTED" && r.appointmentId ? (
                  <Link
                    href={`/desk/appointments/${r.appointmentId}`}
                    className="text-sm font-medium text-accent-ink hover:underline"
                  >
                    View booking
                  </Link>
                ) : null}
                <Badge
                  tone={r.status === "ACCEPTED" ? "ok" : "neutral"}
                >
                  {r.status === "ACCEPTED" ? "Booked" : r.status === "DECLINED" ? "Declined" : "Withdrawn"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
