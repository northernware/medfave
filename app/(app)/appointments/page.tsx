import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { appointmentListQuery, toAppointmentListItem } from "@/lib/queries";
import { instantToDb } from "@/lib/datetime";
import { AppointmentList } from "@/components/appointment-list";
import { buttonClass, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Appointments" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

/**
 * How many rows one screen of this list holds.
 *
 * The cap is still here, but it is no longer silent: a list that quietly stops
 * at two hundred looks identical to a clinic with two hundred appointments.
 */
const PAGE_LIMIT = 200;

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const doctor = await requireDoctor();
  const { view } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "upcoming";

  const now = instantToDb(new Date());

  let query = appointmentListQuery()
    .where((a) => a.doctorId.eq(doctor.id))
    .orderBy((a) => (active === "past" ? a.scheduledAt.desc() : a.scheduledAt.asc()))
    .limit(PAGE_LIMIT);

  if (active === "upcoming") query = query.where((a) => a.scheduledAt.gte(now));
  else if (active === "past") query = query.where((a) => a.scheduledAt.lt(now));

  const appointments = (await query.all()).map(toAppointmentListItem);
  const capped = appointments.length === PAGE_LIMIT;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointments"
        subtitle="Grouped by day, in clinic time."
        actions={
          <>
            <Link href="/appointments/new?source=WALK_IN" className={buttonClass("secondary")}>
              Register walk-in
            </Link>
            <Link href="/appointments/new" className={buttonClass("primary")}>
              Book appointment
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-border">
        <nav aria-label="Filter appointments" className="flex gap-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/appointments?view=${v.key}`}
              aria-current={v.key === active ? "page" : undefined}
              className={[
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                v.key === active
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              ].join(" ")}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        {appointments.length > 0 ? (
          <p className="tabular pb-2 text-xs text-ink-muted">
            {capped
              ? `First ${PAGE_LIMIT} shown`
              : `${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"}`}
          </p>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <AppointmentList
          appointments={appointments}
          emptyTitle={active === "past" ? "No past appointments" : "Nothing booked"}
          emptyDescription={
            active === "past"
              ? "Completed and cancelled visits will collect here."
              : "Book a visit and it will show up on this list and on your dashboard."
          }
        />
      </Card>
    </div>
  );
}
