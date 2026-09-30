import Link from "next/link";
import { Card, CardHeader, buttonClass } from "@/components/ui";
import { TextInput } from "@/components/form";
import { searchDoctors } from "@/lib/discovery";

/**
 * "Find a doctor" on the web: the same search as the app (lib/discovery.ts).
 * A plain GET form, so it works without script. Each result leads to the
 * clinic's public page, where the visit is asked for in the app.
 */
export async function FindDoctor({ q, action }: { q: string; action: string }) {
  const doctors = await searchDoctors(q);

  return (
    <Card>
      <CardHeader title="Find a doctor" subtitle="Doctors on Medfave, by name, specialty, clinic or place." />
      <form action={action} className="flex gap-2 px-5 pt-4">
        <TextInput name="q" defaultValue={q} placeholder="Pediatrics, Quezon City, Dr. Santos…" aria-label="Search" />
        <button className={buttonClass("primary", "shrink-0")}>Search</button>
      </form>
      {doctors.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted">
          {q ? "No doctors match that yet." : "No clinics are listed yet."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {doctors.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium">{d.fullName}</p>
                <p className="truncate text-sm text-ink-muted">
                  {[d.specialty, d.clinic.name, d.clinic.address].filter(Boolean).join(" · ")}
                </p>
              </div>
              {d.clinic.slug ? (
                <Link href={`/c/${d.clinic.slug}`} className={buttonClass("secondary", "shrink-0")}>
                  View clinic
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
