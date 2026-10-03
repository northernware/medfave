import type { Metadata } from "next";
import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { formatDate, instantFromDb } from "@/lib/datetime";
import { fullName, SERVICE_LABELS } from "@/lib/domain";
import { FEEDBACK_TAG_LABELS, SCORE_WORDS, type FeedbackTag } from "@/lib/faves";
import { orm } from "@/src/prisma/db";
import { Pager } from "@/components/pager";
import { RatingFace } from "@/components/rating-face";
import { Badge, Card, EmptyState, PageHeader, Stat, StatStrip } from "@/components/ui";

export const metadata: Metadata = { title: "Patient feedback" };

const VIEWS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const PAGE_SIZE = 25;
/** Ratings of 1–3: the ones worth reading first. */
const LOW = [1, 2, 3];

const tagsOf = (tags: string | null) => (tags ? (tags.split(",") as FeedbackTag[]) : []);

/**
 * What patients said after their visits with this doctor: a face from 1 to 5,
 * what stood out, and a line. Only the clinic sees it; it is never public
 * (medfave-design PRODUCT.md, decision 6).
 */
export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const doctor = await requireDoctor();
  const { view, page: pageParam } = await searchParams;
  const active: ViewKey = VIEWS.some((v) => v.key === view) ? (view as ViewKey) : "all";

  // Every answered rating, for the figures. A clinic's feedback is small enough to sum here.
  const [rated, faves] = await Promise.all([
    orm.VisitFeedback
      .select("score", "tags")
      .where((f) => f.doctorId.eq(doctor.id))
      .where((f) => f.score.gte(1))
      .all(),
    orm.Fave.where((f) => f.doctorId.eq(doctor.id)).aggregate((agg) => ({ n: agg.count() })),
  ]);
  const scores = rated.map((r) => r.score!);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const good = scores.filter((s) => s >= 4).length;
  const tagCounts = new Map<FeedbackTag, number>();
  for (const r of rated) for (const t of tagsOf(r.tags)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const mentions = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  let list = orm.VisitFeedback
    .select("id", "score", "tags", "note", "createdAt")
    .include("appointment", (a) =>
      a.select("id", "scheduledAt", "service").include("patient", (p) => p.select("id", "firstName", "middleName", "lastName")),
    )
    .where((f) => f.doctorId.eq(doctor.id))
    .where((f) => f.score.gte(1));
  let counted = orm.VisitFeedback.where((f) => f.doctorId.eq(doctor.id)).where((f) => f.score.gte(1));
  if (active === "attention") {
    list = list.where((f) => f.score.in(LOW));
    counted = counted.where((f) => f.score.in(LOW));
  }

  const total = (await counted.aggregate((agg) => ({ n: agg.count() }))).n;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pages);
  const items = await list
    .orderBy((f) => f.createdAt.desc())
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return (
    <div className="space-y-3">
      <PageHeader title="Patient feedback" subtitle="What patients said after their visits. Only your clinic sees this." />

      <StatStrip>
        <Stat label="Average" value={average ? average.toFixed(1) : "—"} hint="out of 5" />
        <Stat label="Ratings" value={scores.length} />
        <Stat label="Good or great" value={scores.length ? `${Math.round((good / scores.length) * 100)}%` : "—"} hint="4 or 5" />
        <Stat label="Faves" value={faves.n} hint="patients keeping you close" />
      </StatStrip>

      {mentions.length > 0 ? (
        <Card className="space-y-2 px-4 py-3">
          <p className="text-sm font-medium text-ink-muted">What patients mention</p>
          <div className="flex flex-wrap gap-1.5">
            {mentions.map(([tag, n]) => (
              <Badge key={tag} tone={["LONG_WAIT", "RUSHED", "UNCLEAR", "UNFRIENDLY", "COST"].includes(tag) ? "warn" : "accent"}>
                {FEEDBACK_TAG_LABELS[tag] ?? tag} · {n}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <nav aria-label="Filter feedback" className="flex gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/feedback?view=${v.key}`}
            aria-current={v.key === active ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              v.key === active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title={active === "attention" ? "Nothing to look into" : "No ratings yet"}
            description={
              active === "attention"
                ? "Ratings of 1 to 3 appear here, so they're easy to find."
                : "After a visit is completed, the app asks the patient how it went. Their answers appear here."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((f) => (
              <li key={f.id} className="flex gap-3 px-4 py-3">
                <RatingFace score={f.score!} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">{SCORE_WORDS[f.score!]}</span>
                    <span className="text-ink-muted">
                      {" "}
                      · <Link href={`/patients/${f.appointment.patient.id}`} className="hover:underline">{fullName(f.appointment.patient)}</Link> ·{" "}
                      <Link href={`/appointments/${f.appointment.id}`} className="hover:underline">
                        {SERVICE_LABELS[f.appointment.service]}, {formatDate(instantFromDb(f.appointment.scheduledAt))}
                      </Link>
                    </span>
                  </p>
                  {tagsOf(f.tags).length ? (
                    <div className="flex flex-wrap gap-1">
                      {tagsOf(f.tags).map((t) => (
                        <Badge key={t}>{FEEDBACK_TAG_LABELS[t] ?? t}</Badge>
                      ))}
                    </div>
                  ) : null}
                  {f.note ? <p className="text-sm text-ink">“{f.note}”</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager
          page={page}
          pages={pages}
          pageSize={PAGE_SIZE}
          total={total}
          shown={items.length}
          hrefFor={(n) => `/feedback?view=${active}${n > 1 ? `&page=${n}` : ""}`}
          unit="rating"
        />
      </Card>
    </div>
  );
}
