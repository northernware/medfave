"use client";

import { buttonClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={buttonClass("primary", "px-6 py-3")}>
      Print poster
    </button>
  );
}
