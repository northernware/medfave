import Link from "next/link";
import { buttonClass } from "@/components/ui";

/**
 * Page controls for a list that is longer than one screenful.
 *
 * Offset paging rather than a cursor: these lists are ordered by a time the
 * user is looking at and jumped around in, so "page 3 of 9" is information
 * they can act on, and a cursor's promise — stable paging while rows are being
 * inserted — is worth less here than knowing how much there is.
 */
export function Pager({
  page,
  pages,
  pageSize,
  total,
  shown,
  hrefFor,
  unit = "item",
}: {
  page: number;
  pages: number;
  /** Rows per page — not the same as `shown`, which the last page cuts short. */
  pageSize: number;
  total: number;
  /** How many rows this page actually rendered. */
  shown: number;
  hrefFor: (page: number) => string;
  unit?: string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;
  const plural = total === 1 ? unit : `${unit}s`;

  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5"
    >
      <p className="tabular text-xs text-ink-muted">
        {pages > 1 ? (
          <>
            {first}–{last} of {total} {plural}
          </>
        ) : (
          <>
            {total} {plural}
          </>
        )}
      </p>

      {pages > 1 ? (
        <span className="flex items-center gap-2">
          {/* Rendered as text rather than a disabled link at the ends: there is
              nothing to press, so there should be nothing that looks pressable. */}
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={buttonClass("secondary")} rel="prev">
              Previous
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-[13px] text-ink-faint">Previous</span>
          )}
          <span className="tabular text-xs text-ink-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} className={buttonClass("secondary")} rel="next">
              Next
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-[13px] text-ink-faint">Next</span>
          )}
        </span>
      ) : null}
    </nav>
  );
}
