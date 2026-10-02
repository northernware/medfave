"use client";

import { buttonClass } from "@/components/ui";

/**
 * What to do with the card once it's on screen. Printing is the browser's own
 * (the page is laid out for it), and the link is for sharing on a phone, where
 * the share sheet exists; a desktop copies it instead.
 */
export function CardActions({ name }: { name: string }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${name} · emergency card`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button onClick={() => window.print()} className={buttonClass("secondary")}>
        Print or save as PDF
      </button>
      <button onClick={share} className={buttonClass("secondary")}>
        Share
      </button>
    </div>
  );
}
