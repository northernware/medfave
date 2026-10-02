import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { instantFromDb, instantToDb } from "@/lib/datetime";
import { sweepNoShows } from "@/lib/no-show";
import { clinicDoctors } from "@/lib/clinic";
import { AppointmentList } from "@/components/appointment-list";
import { Pager } from "@/components/pager";
import { buttonClass, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Appointments" };

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];
const PAGE_SIZE = 50;

export default async function DeskAppointmentsPage({
  searchParams,
}: PageProps<"/desk/appointments">) {
  const staff = await requireStaff();
  const { view, page: pageParam } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "upcoming";

  const at = new Date();
  for (const doctor of await clinicDoctors(staff.clinicId)) await sweepNoShows(doctor.id, at);
  const now = instantToDb(at);

  // Scoped by clinic, not by clinician: the desk books for everybody who works
  // here, and sees exactly that much.
  let list = orm.Appointment
    .select("id", "scheduledAt", "durationMinutes", "service", "reason", "status", "priority", "visitType")
    .include("patient", (p) =>
      p.select("id", "firstName", "middleName", "lastName").include("household", (h) => h.select("id", "name")),
    )
    .include("medicalRecord", (r) => r.select("id"))
    .where((a) => a.clinicId.eq(staff.clinicId));
  let counted = orm.Appointment.where((a) => a.clinicId.eq(staff.clinicId));

  if (active === "upcoming") {
    list = list.where((a) => a.scheduledAt.gte(now));
    counted = counted.where((a) => a.scheduledAt.gte(now));
  } else if (active === "past") {
    list = list.where((a) => a.scheduledAt.lt(now));
    counted = counted.where((a) => a.scheduledAt.lt(now));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);

  const appointments = (
    await list
      .orderBy((a) => (active === "past" ? a.scheduledAt.desc() : a.scheduledAt.asc()))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)
      .all()
  ).map((a) => ({ ...a, scheduledAt: instantFromDb(a.scheduledAt) }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointments"
        subtitle="Everything booked at this clinic."
        actions={
          <>
            <Link href="/desk/appointments/new?source=WALK_IN" className={buttonClass("secondary")}>
              Register walk-in
            </Link>
            <Link href="/desk/appointments/new" className={buttonClass("primary")}>
              Book appointment
            </Link>
          </>
        }
      />


      <Card className="overflow-hidden">
        {/* The filter heads the list it filters. */}
        <nav aria-label="Filter appointments" className="flex gap-1 border-b border-border px-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/desk/appointments?view=${v.key}`}
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
        <AppointmentList
          appointments={appointments}
          hrefFor={(id) => `/desk/appointments/${id}`}
          emptyTitle={active === "past" ? "No past appointments" : "Nothing booked"}
          emptyDescription="Book a visit and it will show up here."
        />
        <Pager
          page={page}
          pages={pages}
          pageSize={PAGE_SIZE}
          total={total}
          shown={appointments.length}
          hrefFor={(n) => `/desk/appointments?view=${active}${n > 1 ? `&page=${n}` : ""}`}
          unit="appointment"
        />
      </Card>
    </div>
  );
}
