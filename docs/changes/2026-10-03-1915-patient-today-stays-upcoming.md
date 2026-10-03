# Patient API: today's visit stays upcoming until it's over

Opened: 2026-10-03 19:15 PHT

## What
- `GET /patient/appointments`: a visit today that is pending, confirmed, checked in or in consultation stays in `upcoming` after its start time; it moves to `past` once it's completed, cancelled or a no-show, or the day ends. Before this, the split was by the clock alone.
- `canMove` is false once a visit's start time has passed.
- `docs/api.md` updated.

## Why
In the mobile app the next-visit card vanished at the start time, while the patient was still in the waiting room or with the doctor. Mobile then shows "Checked in" and "With the doctor" on that card.

## Tested
- `tsc --noEmit` and `eslint` on the route clean. Not exercised against the database: no demo visit is underway today.

## Not done / next
- Mobile: card text for checked in and in consultation.
