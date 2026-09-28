"use client";

import { useState } from "react";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, string> = {
  system: "Match device",
  light: "Light",
  dark: "Dark",
};

const ICONS: Record<Theme, string> = {
  system: "M4 5h16v11H4zM9 20h6M12 16v4",
  light:
    "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  dark: "M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z",
};

/** Puts the choice on <html> for the stylesheet, and in the cookie for the server. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.setAttribute("data-theme", theme);
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

/**
 * Three-way switch: follow the device, or force light or dark.
 *
 * The change is applied on the spot — the attribute on <html> is what the
 * stylesheet reads — and the cookie makes the server render it that way from
 * the next request on. No round trip, so nothing on the page reloads.
 */
export function ThemeToggleControl({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5"
    >
      {THEMES.map((option) => {
        const active = option === theme;
        return (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={active}
            aria-label={LABELS[option]}
            title={LABELS[option]}
            className={[
              "grid size-7 place-items-center rounded-full transition-colors",
              active ? "bg-accent-soft text-accent-ink" : "text-ink-faint hover:text-ink",
            ].join(" ")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d={ICONS[option]} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
