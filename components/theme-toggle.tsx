import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { ThemeToggleControl } from "./theme-toggle-control";

/** The theme switch, starting from whatever this viewer last chose. */
export async function ThemeToggle() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <ThemeToggleControl initial={theme} />;
}
