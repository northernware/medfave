import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveHousehold, deleteHousehold, restoreHousehold } from "@/app/actions/households";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { formatDateTime, instantFromDb, instantToDb } from "@/lib/datetime";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/datetime";
import { ageFrom, fullName, RELATIONSHIP_LABELS, SEX_LABELS } from "@/lib/domain";
import { AppointmentList } from "@/components/appointment-list";
import { DangerZone } from "@/components/danger-zone";
import { Badge, buttonClass, Card, CardHeader, Detail, EmptyState, PageHeader, Prose } from "@/components/ui";

async function loadHousehold(doctorId: string, householdId: string) {
  return orm.Household
    .include("patients", (p) =>
      p
        .select(
          "id",
          "firstName",
          "middleName",
          "lastName",
          "dateOfBirth",
          "sex",
          "relationship",
          "allergyStatus",
          "archivedAt",
        )
        .include("allergies", (a) => a.select("id", "severity"))
        // Archived visits are out of the chart, so they are out of its count.
        .include("medicalRecords", (r) => r.where((x) => x.archivedAt.isNull()).count())
        .orderBy((x) => x.dateOfBirth.asc()),
    )
    .where((h) => h.id.eq(householdId))
    .where((h) => h.doctorId.eq(doctorId))
    .first();
}

export async function generateMetadata({ params }: PageProps<"/households/[id]">): Promise<Metadata> {
  const doctor = await requireDoctor();
  const { id } = await params;
  const household = await orm.Household
    .select("name")
    .where((h) => h.id.eq(id))
    .where((h) => h.doctorId.eq(doctor.id))
    .first();
  return { title: household ? `${household.name} household` : "Household" };
}

export default async function HouseholdPage({
  params,
  searchParams,
}: PageProps<"/households/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const { blocked } = await searchParams;

  const household = await loadHousehold(doctor.id, id);
  if (!household) notFound();

  // Archived members stay listed here, apart from the rest: this is where
  // somebody looking for them would come.
  const members = household.patients.filter((p) => p.archivedAt === null);
  const setAside = household.patients.filter((p) => p.archivedAt !== null);
  const archived = household.archivedAt !== null;
  const archivedBy = household.archivedById
    ? await orm.Account.select("fullName").where((a) => a.id.eq(household.archivedById!)).first()
    : null;

  // The members are already loaded, so the contact is a lookup rather than a query.
  const primaryContact =
    household.patients.find((p) => p.id === household.primaryContactId) ?? null;

  const upcoming = (
    await appointmentListQuery()
      .where((a) => a.doctorId.eq(doctor.id))
      .where((a) => a.patient.some((p) => p.householdId.eq(household.id)))
      .where((a) => a.scheduledAt.gte(instantToDb(new Date())))
      .orderBy((a) => a.scheduledAt.asc())
      .limit(10)
      .all()
  ).map(toAppointmentListItem);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${household.name} household`}
        subtitle={`${members.length} ${members.length === 1 ? "member" : "members"}${setAside.length ? ` · ${setAside.length} archived` : ""}`}
        actions={
          archived ? (
            <form action={restoreHousehold}>
              <input type="hidden" name="householdId" value={household.id} />
              <button className={buttonClass("primary")}>Restore household</button>
            </form>
          ) : (
            <>
              <Link href={`/households/${household.id}/patients/new`} className={buttonClass("primary")}>
                Add member
              </Link>
              <Link href={`/households/${household.id}/edit`} className={buttonClass("secondary")}>
                Edit
              </Link>
            </>
          )
        }
      />

      {typeof blocked === "string" && blocked ? (
        <p
          role="alert"
          className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-ink"
        >
          {blocked}
        </p>
      ) : null}

      {archived ? (
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
          <p className="font-medium">
            Archived {formatDateTime(instantFromDb(household.archivedAt!))}
            {archivedBy ? ` by ${archivedBy.fullName}` : ""}.
          </p>
          <p className="mt-0.5 text-ink-muted">
            {household.archiveReason ?? "No reason was given."} It is out of the working lists;
            restoring it brings it back as it was.
          </p>
        </div>
      ) : null}

      <Card className="p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Address" value={household.address} />
          <Detail label="Contact number" value={household.contactNumber} />
          <Detail
            label="Primary contact"
            value={
              primaryContact ? (
                <Link
                  href={`/patients/${primaryContact.id}`}
                  className="text-accent-ink hover:underline"
                >
                  {fullName(primaryContact)}
                </Link>
              ) : household.patients.length > 0 ? (
                <Link
                  href={`/households/${household.id}/edit`}
                  className="text-warn-ink hover:underline"
                >
                  Nobody assigned
                </Link>
              ) : null
            }
          />
        </dl>
        {household.notes ? (
          <div className="mt-4 border-t border-border pt-4">
            <Prose label="Household notes" text={household.notes} />
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Members"
          action={
            archived ? null : (
              <Link
                href={`/households/${household.id}/patients/new`}
                className="text-sm font-medium text-accent-ink hover:underline"
              >
                Add member
              </Link>
            )
          }
        />
        {members.length === 0 ? (
          <EmptyState
            title={setAside.length ? "Nobody here is in the working list" : "No members yet"}
            description={
              setAside.length
                ? "Everyone in this household has been archived. Their charts are listed below."
                : "Add the people in this household so you can book them and keep their records."
            }
            action={
              archived ? null : (
                <Link href={`/households/${household.id}/patients/new`} className={buttonClass("primary")}>
                  Add member
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {members.map((patient) => (
              <li key={patient.id} className="transition-colors hover:bg-surface-muted">
                <Link href={`/patients/${patient.id}`} className="flex items-baseline gap-4 px-5 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="truncate font-medium">{fullName(patient)}</span>
                      {patient.allergies.length > 0 ? (
                        <Badge tone={patient.allergies.some((a) => a.severity === "SEVERE") ? "danger" : "warn"}>
                          {patient.allergies.length} {patient.allergies.length === 1 ? "allergy" : "allergies"}
                        </Badge>
                      ) : patient.allergyStatus === "UNKNOWN" ? (
                        <Badge tone="neutral">Allergies not asked</Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-muted">
                      {RELATIONSHIP_LABELS[patient.relationship]} · {SEX_LABELS[patient.sex]} ·{" "}
                      {ageFrom(calendarDateFromDb(patient.dateOfBirth))} · born{" "}
                      {formatCalendarDate(calendarDateFromDb(patient.dateOfBirth))}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm text-ink-muted">
                    {patient.medicalRecords}{" "}
                    {patient.medicalRecords === 1 ? "visit" : "visits"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {setAside.length > 0 ? (
        <Card>
          <CardHeader
            title="Archived members"
            subtitle="Out of the working lists, with everything in their charts kept. Open one to restore it."
          />
          <ul className="divide-y divide-border">
            {setAside.map((patient) => (
              <li key={patient.id} className="transition-colors hover:bg-surface-muted">
                <Link href={`/patients/${patient.id}`} className="flex items-baseline gap-4 px-5 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {fullName(patient)}
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-faint">
                    {patient.medicalRecords} {patient.medicalRecords === 1 ? "visit" : "visits"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Upcoming appointments" />
        <AppointmentList
          appointments={upcoming}
          emptyTitle="Nothing booked"
          emptyDescription="No one in this household has an upcoming appointment."
        />
      </Card>

      {/* Deleting a household cascades through every chart in it, so it is
          only offered for one with nobody in it at all. Anything else is
          archived, and only once its members have been dealt with. */}
      {household.patients.length === 0 ? (
        <DangerZone
          action={deleteHousehold}
          fieldName="householdId"
          fieldValue={household.id}
          summary="Delete this household"
          warning={`Nobody is registered in the ${household.name} household, so deleting it removes only its name, address and notes.`}
          confirmLabel="Delete household"
        />
      ) : archived ? null : members.length === 0 ? (
        <DangerZone
          action={archiveHousehold}
          fieldName="householdId"
          fieldValue={household.id}
          variant="secondary"
          summary="Archive this household"
          warning="Takes the household out of the working lists. Its archived members and their charts are untouched, and restoring it brings it back as it was."
          confirmLabel="Archive household"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Reason</span>
            <input
              name="archiveReason"
              required
              maxLength={300}
              placeholder="The family has moved away"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        </DangerZone>
      ) : (
        <p className="px-1 text-xs text-ink-faint">
          To set this household aside, archive or move each of its members first. A household with
          people in it cannot be deleted.
        </p>
      )}
    </div>
  );
}
