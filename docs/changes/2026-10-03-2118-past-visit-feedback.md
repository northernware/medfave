# Past visits carry their rating

Opened: 2026-10-03 21:18 PHT

## What
- `GET /patient/appointments`: completed past visits add `feedback` (this login's score, tags and note, or null), `canRate` (within 14 days of the visit) and `doctorFaved`.
- `POST /patient/appointments/:id/feedback` refuses visits more than 14 days old (`409`).

## Why
The app's Past tab lets a patient see, change, or come back to a rating.

## Tested
- `tsc --noEmit`, `eslint` clean; checked against the deployed API after merge.
