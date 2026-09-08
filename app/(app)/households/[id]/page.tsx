import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteHousehold } from "@/app/actions/households";
import { requireDoctor } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { instantToDb } from "@/lib/datetime";
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

export default async function HouseholdPage({ params }: PageProps<"/households/[id]">) {
  const doctor = await requireDoctor();
  const { id } = await params;

  const household = await loadHousehold(doctor.id, id);
  if (!household) notFound();

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
        subtitle={`${household.patients.length} ${household.patients.length === 1 ? "member" : "members"}`}
        actions={
          <>
            <Link href={`/households/${household.id}/patients/new`} className={buttonClass("primary")}>
              Add member
            </Link>
            <Link href={`/households/${household.id}/edit`} className={buttonClass("secondary")}>
              Edit
            </Link>
          </>
        }
      />

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
            <Link
              href={`/households/${household.id}/patients/new`}
              className="text-sm font-medium text-accent-ink hover:underline"
            >
              Add member
            </Link>
          }
        />
        {household.patients.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Add the people in this household so you can book them and keep their records."
            action={
              <Link href={`/households/${household.id}/patients/new`} className={buttonClass("primary")}>
                Add member
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {household.patients.map((patient) => (
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

      <Card>
        <CardHeader title="Upcoming appointments" />
        <AppointmentList
          appointments={upcoming}
          emptyTitle="Nothing booked"
          emptyDescription="No one in this household has an upcoming appointment."
        />
      </Card>

      <DangerZone
        action={deleteHousehold}
        fieldName="householdId"
        fieldValue={household.id}
        summary="Delete this household"
        warning={`This permanently removes the ${household.name} household along with all ${household.patients.length} member records, their appointments and their medical records. It cannot be undone.`}
        confirmLabel="Delete household and all records"
      />
    </div>
  );
}
