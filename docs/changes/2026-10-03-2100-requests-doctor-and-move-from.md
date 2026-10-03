# Patient requests: the doctor, and where a move is from

Opened: 2026-10-03 21:00 PHT

## What
- `GET /patient/requests` adds `doctor: { id, fullName }` and, for a move, `rescheduleFrom`: the visit's current time.

## Why
The app's redesigned request cards show who it's with and "from … to …" for a move.

## Tested
- `tsc --noEmit`, `eslint` clean; checked against the deployed API after merge.
