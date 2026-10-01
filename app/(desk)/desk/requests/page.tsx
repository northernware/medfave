import type { Metadata } from "next";
import Link from "next/link";
import { acceptRequest, declineRequest } from "@/app/actions/requests";
import { findPossibleDuplicates } from "@/lib/queries";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { visitTimes } from "@/lib/patient-visits";
import { calendarDateFromDb, formatCalendarDate, formatDateTime, instantFromDb } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import type { Relationship } from "@/lib/enums";

// "Ana Santos, their child": who the person is to whoever asked.
const RELATIONSHIP_WORD: Record<Relationship, string> = {
  HEAD: "family",
  SPOUSE: "spouse",
  CHILD: "child",
  PARENT: "parent",
  SIBLING: "sibling",
  GRANDPARENT: "grandparent",
  OTHER: "family",
};
import { Badge, buttonClass, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Booking requests" };

export default async function DeskRequestsPage({ searchParams }: PageProps<"/desk/requests">) {
  const staff = await requireStaff();
  const { refused, needs } = await searchParams;

  const [pending, decided] = await Promise.all([
    orm.AppointmentRequest
      .select(
        "id", "preferredDate", "preferredTime", "service", "reason", "createdAt", "rescheduleOfId",
        "newFirstName", "newMiddleName", "newLastName", "newDateOfBirth", "newContactNumber", "newEmail",
        "forOther", "newRelationship",
      )
      .include("doctor", (d) => d.select("fullName"))
      .include("requestedBy", (a) => a.select("fullName"))
      .include("patient", (p) =>
        p.select("id", "firstName", "middleName", "lastName", "contactNumber", "patientNumber"),
      )
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.eq("PENDING"))
      .orderBy((r) => r.createdAt.asc())
      .all(),
    orm.AppointmentRequest
      .select("id", "preferredDate", "preferredTime", "service", "status", "decisionNote", "decidedAt", "appointmentId", "newFirstName", "newMiddleName", "newLastName")
      .include("patient", (p) => p.select("id", "firstName", "middleName", "lastName"))
      .where((r) => r.clinicId.eq(staff.clinicId))
      .where((r) => r.status.in(["ACCEPTED", "DECLINED", "WITHDRAWN"]))
      .orderBy((r) => r.updatedAt.desc())
      .limit(15)
      .all(),
  ]);

  // New patients: look-alikes the clinic may already have, so nobody is
  // registered twice. The desk decides; nothing is merged automatically.
  const lookalikes = new Map(
    await Promise.all(
      pending
        .filter((r) => !r.patient)
        .map(async (r) => [
          r.id,
          await findPossibleDuplicates(staff.clinicId, {
            firstName: r.newFirstName ?? "",
            lastName: r.newLastName ?? "",
            dateOfBirth: r.newDateOfBirth ?? "",
            contactNumber: r.newContactNumber,
            email: r.newEmail,
          }),
        ] as const),
    ),
  );
  const moving = await visitTimes(pending.map((r) => r.rescheduleOfId));
  const nameOf = (r: { patient: Parameters<typeof fullName>[0] | null; newFirstName: string | null; newMiddleName: string | null; newLastName: string | null }) =>
    r.patient ? fullName(r.patient) : fullName({ firstName: r.newFirstName ?? "", middleName: r.newMiddleName, lastName: r.newLastName ?? "" });

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
                    {r.patient ? (
                      <Link href={`/desk/patients/${r.patient.id}`} className="text-sm font-medium hover:underline">
                        {fullName(r.patient)}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">
                        {nameOf(r)} <Badge tone="accent">New patient</Badge>
                      </span>
                    )}
                    {/* Asked by a parent or carer: accepting lets them look after this
                        chart; it doesn't become their own. */}
                    {r.forOther ? (
                      <p className="text-sm text-ink-muted">
                        Asked by {r.requestedBy.fullName}
                        {r.newRelationship ? `, their ${RELATIONSHIP_WORD[r.newRelationship]}` : ""}. They&rsquo;ll be
                        able to see this chart and book for them.
                      </p>
                    ) : null}
                    {r.rescheduleOfId && moving.get(r.rescheduleOfId) ? (
                      <p className="text-sm">
                        <Badge tone="warn">Move</Badge>{" "}
                        <span className="text-ink-muted">from {formatDateTime(moving.get(r.rescheduleOfId)!)}. Accepting frees that time.</span>
                      </p>
                    ) : null}
                    <p className="text-sm text-ink-muted">
                      {r.doctor ? <span className="font-medium text-ink">For {r.doctor.fullName} · </span> : null}
                      {SERVICE_LABELS[r.service]} · {r.reason}
                    </p>
                    <p className="text-xs text-ink-faint">
                      Asked {formatDateTime(instantFromDb(r.createdAt))}
                      {(r.patient?.contactNumber ?? r.newContactNumber) ? ` · ${r.patient?.contactNumber ?? r.newContactNumber}` : ""}
                      {!r.patient && r.newDateOfBirth ? ` · born ${formatCalendarDate(calendarDateFromDb(r.newDateOfBirth))}` : ""}
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
                    {r.patient ? null : (
                      <fieldset className="w-full space-y-1 text-sm">
                        <legend className="mb-1 font-medium">Their record</legend>
                        <label className="flex gap-2">
                          <input type="radio" name="record" value="new" defaultChecked className="accent-[var(--accent)]" />
                          Create a new record from their details
                        </label>
                        {(lookalikes.get(r.id) ?? []).map((m) => (
                          <label key={m.id} className="flex gap-2">
                            <input type="radio" name="record" value={m.id} className="accent-[var(--accent)]" />
                            <span>
                              Same person as <strong>{m.name}</strong> · born {m.dateOfBirth} · {m.householdName} household
                              <span className="text-ink-faint"> (matched on {m.matchedOn.join(", ")})</span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    )}
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
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  {r.status === "ACCEPTED" && r.appointmentId ? (
                    <Link
                      href={`/desk/appointments/${r.appointmentId}`}
                      className="block text-sm font-medium hover:text-accent-ink hover:underline sm:truncate"
                    >
                      {nameOf(r)}
                    </Link>
                  ) : (
                    <span className="block text-sm font-medium sm:truncate">{nameOf(r)}</span>
                  )}
                  <span className="block text-xs text-ink-muted sm:truncate">
                    {SERVICE_LABELS[r.service]} ·{" "}
                    {formatCalendarDate(calendarDateFromDb(r.preferredDate))}
                    {r.decisionNote ? ` · ${r.decisionNote}` : ""}
                  </span>
                </span>
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
