import { Card, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/datetime";
import type { HistoryEntry } from "@/lib/visit-history";

/** Asked for, accepted, booked, arrived, seen: a visit's history with who did each step. */
export function VisitHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader title="History" />
      <ol className="space-y-3 px-5 py-4">
        {entries.map((e, i) => (
          <li key={i} className="relative pl-5 text-sm">
            <span aria-hidden="true" className="absolute top-1.5 left-0 size-2 rounded-full bg-accent" />
            <p className="font-medium">
              {e.label}
              {e.by ? <span className="font-normal text-ink-muted"> · {e.by}</span> : null}
            </p>
            <p className="tabular text-xs text-ink-faint">{formatDateTime(e.at)}</p>
            {e.detail ? <p className="text-xs text-ink-muted">{e.detail}</p> : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
