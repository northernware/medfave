# An early check-in holds its old time until the consultation starts

Opened: 2026-10-03 20:01 PHT

## What
- New `lib/held-slots.ts` → `heldSlots(doctorId, from, to)`: for each visit that is checked in after being moved from another day, the time it was booked for. Read from its latest check-in event.
- That time counts as busy everywhere free time is worked out: `findClash` (booking, accepting requests, restoring), the patient's openings, and the staff booking form's busy times.
- So undoing an early check-in always fits back. Starting the consultation (no undo after that) frees the old time.
- `docs/api.md` notes it under the status endpoint.

## Why
Owner hit it on the phone: a checked-in visit's slot was rebooked, and its undo was then refused. An accidental check-in should undo cleanly.

## Tested
- `tsc --noEmit` and `eslint` clean. End-to-end check against the deployed API after merge: see the PR comment.

## Heads-up
- No migration: the hold comes from `AppointmentEvent.previousScheduledAt`, which already exists.
