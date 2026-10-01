"use client";

import { MonitorIcon } from "@solar-icons/react/linear/monitor";
import { MoonIcon } from "@solar-icons/react/linear/moon";
import { Sun2Icon } from "@solar-icons/react/linear/sun-2";
import { useState } from "react";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, string> = {
  system: "Match device",
  light: "Light",
  dark: "Dark",
};

const ICON_COMPONENTS = { system: MonitorIcon, light: Sun2Icon, dark: MoonIcon } satisfies Record<Theme, unknown>;


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
            {(() => {
              const Icon = ICON_COMPONENTS[option];
              return <Icon className="size-4" aria-hidden />;
            })()}
          </button>
        );
      })}
    </div>
  );
}
