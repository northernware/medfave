# Patient feedback page for the doctor

Opened: 2026-10-03 22:02 PHT

## What
- `/feedback`, "Patient feedback" in the doctor's sidebar (Patients group):
  - figures: average score, number of ratings, share rated 4 or 5, and how many patients faved the doctor;
  - "What patients mention": each tag with its count, the ones to improve in amber;
  - the ratings, newest first, each with the same face the app shows, the word, the patient, the visit (linked), the tags and the note;
  - a "Needs attention" filter for ratings of 1–3, paged like Records requests.
- `components/rating-face.tsx` draws the app's faces on the web. `FEEDBACK_TAG_LABELS` and `SCORE_WORDS` are in `lib/faves.ts`; keep them in step with the app.

## Why
Patients' feedback was saved (#131, #132) but nowhere for the clinic to read it.

## Tested
- `tsc --noEmit` and `eslint` clean. Signed in as the demo doctor on the local dev server: the page shows the two ratings in the dev database, with the figures. Light mode and phone width not checked.

## Not done / next
- Only the doctor's own visits. A clinic-wide view for an admin is open.
- The front desk view has no link to it.
