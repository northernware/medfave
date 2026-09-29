/**
 * The viewer's light/dark choice.
 *
 * Kept in a plain cookie rather than local storage so the server can render the
 * right theme into the first byte of HTML — no flash of the wrong colours on
 * load. No cookie means "system": the page follows the device's setting.
 */
export const THEME_COOKIE = "theme";

export type Theme = "system" | "light" | "dark";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** Anything that is not an explicit choice falls back to following the device. */
export function parseTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
