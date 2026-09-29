import Link from "next/link";

/**
 * Which doctor a booking or schedule is for, as links: each keeps the rest of
 * the page's query and swaps `doctor`. Shown only when a clinic has more than
 * one doctor; a solo practice never sees it.
 */
export function DoctorPicker({
  label,
  doctors,
  selected,
  hrefFor,
}: {
  label: string;
  doctors: { id: string; fullName: string; specialty: string | null }[];
  selected: string | null;
  hrefFor: (doctorId: string) => string;
}) {
  if (doctors.length < 2) return null;
  return (
    <nav aria-label={label} className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {doctors.map((d) => {
          const on = d.id === selected;
          return (
            <Link
              key={d.id}
              href={hrefFor(d.id)}
              aria-current={on ? "true" : undefined}
              className={[
                "rounded-lg border px-3.5 py-2 text-sm transition-colors",
                on
                  ? "border-accent bg-accent-tint font-semibold text-accent-ink"
                  : "border-border-strong bg-surface text-ink hover:border-accent",
              ].join(" ")}
            >
              {d.fullName}
              {d.specialty ? <span className="ml-1.5 font-normal text-ink-muted">· {d.specialty}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** A page's current query with one key replaced. */
export function withParam(path: string, params: Record<string, string | string[] | undefined>, key: string, value: string) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== key) q.set(k, v);
  q.set(key, value);
  return `${path}?${q.toString()}`;
}
