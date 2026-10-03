# Demo data for the patient app's hidden sections

Opened: 2026-10-03 20:53 PHT

## What
- `npm run db:seed-patient-showcase` (`src/prisma/seed-patient-showcase.ts`) adds, for patient@medfave.com:
  - two documents shared to him;
  - a visit booked but not confirmed;
  - a confirmed visit with a pending move;
  - a declined request with a note from the clinic;
  - a carer (new login marilou@medfave.com / password);
  - Dr. Ana Reyes in his faves.
- Every row's id starts `showcase-`; running it again replaces only those rows. Needs the main seed.

## Why
Owner wanted to see the sections that only appear with particular data.

## Tested
- `tsc --noEmit` and `eslint` clean. Run once against the dev database; Home, Documents, Visits and Profile checked in the Expo web build.

## Heads-up
- The dev database now has these rows and the marilou@medfave.com login.
