# Keep every screen inside a phone's width

Opened: 2026-09-27 23:14 PHT · Updated: 2026-09-29 13:19 PHT · PR #13

## What
Small layout fixes so nothing pushes past a phone's width. There were nine files:
- `app/globals.css`;
- the calendar, dashboard, patient and record pages;
- the auth and manage layouts;
- the schedule forms and the clinical picker.

## Why
Some screens scrolled sideways on phones.

## Tested
- **Updated to today's `main`** (2026-09-29): `main` was merged in. Git carried the dashboard fix to its new location (`app/(app)/page.tsx` became `app/(app)/dashboard/page.tsx`), and all 21 lines this PR adds are present after the merge.
- `tsc` and eslint pass.
- At 390px, all 15 pages measured exactly 390px wide, with no sideways scroll: landing, login, register, dashboard, calendar, appointments, patients, a patient page, households, documents, manage, schedule, staff, desk and account.
