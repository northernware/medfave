/**
 * What a page looks like while it loads: its header and a few cards, in
 * outline. Shown the moment a link is clicked (each section's `loading.tsx`),
 * so a click answers straight away and the frame — sidebar, header — stays put.
 */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  const bar = "rounded-md bg-surface-muted motion-safe:animate-pulse";
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className={`${bar} h-8 w-56`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-5">
              <div className={`${bar} h-5 w-40`} />
              <div className={`${bar} h-4 w-full`} />
              <div className={`${bar} h-4 w-5/6`} />
              <div className={`${bar} h-4 w-2/3`} />
            </div>
          ))}
        </div>
        <div className="hidden space-y-3 rounded-xl border border-border bg-surface p-5 lg:block">
          <div className={`${bar} h-5 w-32`} />
          <div className={`${bar} h-24 w-full`} />
          <div className={`${bar} h-4 w-3/4`} />
        </div>
      </div>
    </div>
  );
}
