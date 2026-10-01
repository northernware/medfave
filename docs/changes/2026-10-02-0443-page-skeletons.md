# Skeletons shaped like their pages

Opened: 2026-10-02 04:43 PHT

## What
- `components/page-skeleton.tsx` is now a kit (header, stat tiles, list card, search, schedule panel, month grid), sized like the real components.
- Each main page has its own outline:
  - **Today** (doctor and desk): tiles, two cards and the schedule panel.
  - **Calendar:** the month and the panel.
  - **Patients, Households, desk Patients:** header, search and rows.
  - **Appointments, Records requests, Requests:** rows.
- Sub-pages such as a patient or a visit get the generic outline, so a list outline doesn't flash before a detail page.

## Why
The first version's single outline didn't look like the pages it stood in for.

## Tested
`tsc` and `eslint` are clean. Not compared on screen.
