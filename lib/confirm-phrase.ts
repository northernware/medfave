/**
 * Permanent deletions ask for a phrase to be typed. The page names it and the
 * action checks it, so a stale page or a hand-made request can't skip the step.
 */
export const DELETE_PHRASES = {
  appointment: "delete appointment",
} as const;

/** Whether the form carries the phrase (case and surrounding space aside). */
export function phraseTyped(formData: FormData, phrase: string) {
  return String(formData.get("confirmation") ?? "").trim().toLowerCase() === phrase;
}
