/*
 * Pages in outline while they load, built from the same shapes as the real
 * ones — the page header, stat tiles, list cards, the schedule panel — so the
 * page fills in where it already stood. Each section's `loading.tsx` picks the
 * outline that matches it; anything without its own gets `PageSkeleton`.
 */

const pulse = "rounded-md bg-surface-muted motion-safe:animate-pulse";
const card = "rounded-xl border border-border bg-surface shadow-card";

function Busy({ children, className = "space-y-3" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** The page title and its line under it, sized like `PageHeader`. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 lg:px-1 lg:pt-5 lg:pb-2">
      <div className="space-y-2">
        <div className={`${pulse} h-9 w-60`} />
        <div className={`${pulse} h-4 w-80 max-w-[70vw]`} />
      </div>
      {action ? <div className={`${pulse} h-10 w-32 rounded-full`} /> : null}
    </div>
  );
}

/** Four tiles: a number, a label, a hint. */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${card} p-5`}>
          <div className={`${pulse} h-8 w-10`} />
          <div className={`${pulse} mt-4 h-4 w-20`} />
          <div className={`${pulse} mt-1.5 h-3 w-28`} />
        </div>
      ))}
    </div>
  );
}

/** A card of rows — people or visits: an avatar or time, two lines, something at the end. */
export function ListSkeleton({ rows = 6, title = true, avatar = true }: { rows?: number; title?: boolean; avatar?: boolean }) {
  return (
    <div className={card}>
      {title ? (
        <div className="border-b border-border px-5 py-4">
          <div className={`${pulse} h-5 w-40`} />
        </div>
      ) : null}
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            {avatar ? <div className={`${pulse} size-9 shrink-0 rounded-full`} /> : <div className={`${pulse} h-4 w-14 shrink-0`} />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className={`${pulse} h-4`} style={{ width: `${45 + ((i * 17) % 35)}%` }} />
              <div className={`${pulse} h-3`} style={{ width: `${25 + ((i * 11) % 30)}%` }} />
            </div>
            <div className={`${pulse} h-6 w-16 rounded-full`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The search box above a list. */
export function SearchSkeleton() {
  return <div className={`${pulse} h-9 w-full max-w-sm`} />;
}

/** The day's schedule panel pinned on the right, as on Today and Calendar. */
export function RailSkeleton() {
  return (
    <div className="xl:fixed xl:top-3 xl:right-3 xl:bottom-3 xl:z-10 xl:w-[340px]">
      <div className={`${card} flex h-full flex-col gap-4 p-4`}>
        <div className="flex items-center justify-between">
          <div className={`${pulse} h-5 w-32`} />
          <div className={`${pulse} size-8 rounded-full`} />
        </div>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`${pulse} h-12 w-9 rounded-lg`} />
          ))}
        </div>
        <div className="flex-1 space-y-6 pt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className={`${pulse} h-3 w-10 shrink-0`} />
              {i % 2 === 0 ? <div className={`${pulse} h-24 flex-1 rounded-lg`} /> : <div className="h-px flex-1 self-center bg-border" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A month: weekday names and five weeks of days. */
export function CalendarSkeleton() {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className={`${pulse} h-6 w-40`} />
        <div className={`${pulse} h-8 w-24 rounded-full`} />
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-20 border-r border-b border-border p-2 sm:h-24">
            <div className={`${pulse} size-6 rounded-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Today (doctor or desk): header, tiles, two cards side by side, the schedule panel. */
export function TodaySkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton />
          <StatsSkeleton />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ListSkeleton rows={5} />
            <ListSkeleton rows={5} avatar={false} />
          </div>
        </div>
      </div>
      <RailSkeleton />
    </Busy>
  );
}

/** A list page: header, search, the list. */
export function ListPageSkeleton({ search = true, avatar = true }: { search?: boolean; avatar?: boolean }) {
  return (
    <Busy className="space-y-3">
      <HeaderSkeleton action />
      {search ? <SearchSkeleton /> : null}
      <ListSkeleton rows={8} title={false} avatar={avatar} />
    </Busy>
  );
}

/** Calendar: header, the month, the schedule panel. */
export function CalendarPageSkeleton() {
  return (
    <Busy>
      <div className="grid grid-cols-1 gap-3 xl:pr-[352px]">
        <div className="min-w-0 space-y-3">
          <HeaderSkeleton />
          <CalendarSkeleton />
        </div>
      </div>
      <RailSkeleton />
    </Busy>
  );
}

/** Anything else: a header and a few cards. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Busy className="space-y-3">
      <HeaderSkeleton />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className={`${card} space-y-3 p-5`}>
              <div className={`${pulse} h-5 w-40`} />
              <div className={`${pulse} h-4 w-full`} />
              <div className={`${pulse} h-4 w-5/6`} />
            </div>
          ))}
        </div>
        <div className={`${card} hidden space-y-3 p-5 lg:block`}>
          <div className={`${pulse} h-5 w-32`} />
          <div className={`${pulse} h-24 w-full`} />
        </div>
      </div>
    </Busy>
  );
}
