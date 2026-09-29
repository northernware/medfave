import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-medium text-ink-faint">404</p>
        <h1 className="mt-1 text-[32px] leading-10 font-semibold tracking-[-0.015em]">Nothing here</h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          That page does not exist, or it belongs to another doctor&rsquo;s records.
        </p>
        <Link href="/dashboard" className={buttonClass("primary", "mt-6")}>
          Back to today
        </Link>
      </div>
    </div>
  );
}
