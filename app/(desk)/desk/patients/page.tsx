import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { orm } from "@/src/prisma/db";
import { calendarDateFromDb } from "@/lib/datetime";
import { ageFrom, fullName } from "@/lib/domain";
import { Pager } from "@/components/pager";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 30;

export default async function DeskPatientsPage({ searchParams }: PageProps<"/desk/patients">) {
  const staff = await requireStaff();
  const { q, page: pageParam } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";

  let list = orm.Patient
    .select("id", "firstName", "middleName", "lastName", "dateOfBirth", "contactNumber", "patientNumber")
    .include("household", (h) => h.select("id", "name"))
    .where((p) => p.clinicId.eq(staff.clinicId))
    // Archived charts are the clinician's to bring back, so the desk works from
    // the live list only.
    .where((p) => p.archivedAt.isNull());
  let counted = orm.Patient
    .where((p) => p.clinicId.eq(staff.clinicId))
    .where((p) => p.archivedAt.isNull());

  if (term) {
    list = list.where((p) => p.lastName.ilike(`%${term}%`));
    counted = counted.where((p) => p.lastName.ilike(`%${term}%`));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);

  const patients = await list
    .orderBy((p) => p.lastName.asc())
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patients"
        subtitle="Names, contact details and households. Clinical notes are the doctor's."
        actions={
          <Link href="/desk/patients/new" className={buttonClass("primary")}>
            Add patient
          </Link>
        }
      />

      <SearchForm placeholder="Search by surname…" defaultValue={term} action="/desk/patients" />

      <Card className="overflow-hidden">
        {patients.length === 0 ? (
          <EmptyState
            title={term ? "Nobody by that name" : "No patients yet"}
            description={term ? "Try a different surname." : "Register somebody to get started."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {patients.map((p) => (
              <li key={p.id} className="transition-colors hover:bg-surface-muted">
                <Link
                  href={`/desk/patients/${p.id}`}
                  className="flex flex-wrap items-baseline gap-x-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium sm:truncate">{fullName(p)}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {p.household.name} household · {ageFrom(calendarDateFromDb(p.dateOfBirth))}
                      {p.contactNumber ? ` · ${p.contactNumber}` : ""}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-ink-faint">
                    {p.patientNumber ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager
          page={page}
          pages={pages}
          pageSize={PAGE_SIZE}
          total={total}
          shown={patients.length}
          hrefFor={(n) =>
            `/desk/patients?${term ? `q=${encodeURIComponent(term)}&` : ""}${n > 1 ? `page=${n}` : ""}`
          }
          unit="patient"
        />
      </Card>
    </div>
  );
}
