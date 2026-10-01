/*
 * People's names as they type them, tidied but not rewritten.
 *
 * Sign-up and the like ask for a first, middle and last name and keep them
 * together as `fullName`, the shape every account already has. Names are
 * stored as typed — "dela Cruz", "McArthur" and "Ma. Teresa" survive — except
 * when the whole thing was typed in one case: "paula santos" and "PAULA
 * SANTOS" both become "Paula Santos". Capitals for a printout are a matter of
 * display, never of storage.
 */

/** Collapses spaces; title-cases a part typed all lower- or all upper-case. */
export function tidyName(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const letters = s.replace(/[^\p{L}]/gu, "");
  const oneCase = letters === letters.toLowerCase() || letters === letters.toUpperCase();
  if (!oneCase) return s;
  // Capital after a start, a space, a hyphen, an apostrophe or a full stop.
  return s.toLowerCase().replace(/(^|[\s\-'’.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Input with `fullName` built from `firstName`, `middleName` and `lastName`
 * when those were sent (both first and last are needed; a missing one leaves
 * `fullName` empty so the form says so). Older clients that send `fullName`
 * alone still work, tidied the same way.
 */
export function withFullName(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const v = input as Record<string, unknown>;
  const parts = ["firstName", "middleName", "lastName"].some((k) => typeof v[k] === "string" && String(v[k]).trim());
  if (!parts) return { ...v, fullName: tidyName(v.fullName) };
  const first = tidyName(v.firstName);
  const middle = tidyName(v.middleName);
  const last = tidyName(v.lastName);
  return { ...v, fullName: first && last ? [first, middle, last].filter(Boolean).join(" ") : "" };
}
