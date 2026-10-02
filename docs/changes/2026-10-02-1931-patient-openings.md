# API: free times a patient can ask for

Opened: 2026-10-02 19:31 PHT

## What
- `lib/openings.ts` `openingsFor(doctorId, service, { date?, limit?, perDay? })`: start times inside the doctor's hours and booking window, clear of breaks and closures (via `slotsForDay`), booked visits (`occupiesSlot`), and times other patients have already asked for (pending requests with a time). Times only, never whose.
- `GET /api/v1/patient/clinic/openings?doctor=&service=&date=`: without `date`, the next 6 (at most 2 a day, 2½ h apart); with `date`, every free time that day. Documented in `docs/api.md`.

## Why
The app's quick "Ask for a time" on Home, and request-form time chips that only show free times. The form currently builds its times from opening hours alone, so patients can ask for taken slots.

## Tested
- `tsc` and `eslint` are clean.
- Against the dev DB as `patient@medfave.com`: next openings skip Sunday, 45-min services get wider gaps than 30-min; Monday 5 Oct's list leaves out the 9:00, 13:30 and 14:00 bookings, the slots overlapping them, and the lunch break. `?date=nope` → 400.

## Not done / next
- medfave-mobile: Home quick times and free-only chips in the request form (next PR there).
- A request is still a request: nothing is held, and two patients can still pick the same time in the same minute.
