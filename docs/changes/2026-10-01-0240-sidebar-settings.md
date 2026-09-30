# Doctor sidebar: My hours and Clinic settings

Opened: 2026-10-01 02:40 PHT

## What
- The doctor's sidebar (`components/nav.tsx`): **Staff** is replaced by
  **My hours** (`/manage/schedule`) and **Clinic settings** (`/manage`:
  details, schedules, staff, chart sharing). Staff stays one tap away in
  Manage's top bar.

## Why
The owner couldn't find where a verified doctor edits hours or clinic
details: they were only reachable through "Staff".

## Tested
- `tsc` and `eslint` pass. Signed in as doctor@medfave.com: the sidebar
  lists My hours and Clinic settings; Clinic settings opens `/manage` with
  the details and schedule.
