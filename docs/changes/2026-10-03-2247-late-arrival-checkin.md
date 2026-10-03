# Late arrivals: check in a no-show on its day

Opened: 2026-10-03 22:47 PHT

## What
- `NO_SHOW → CHECKED_IN` is allowed on the visit's own clinic day (`not-today` otherwise). The visit moves to the arrival time, with the old time in its history, and joins the queue without an overlap check, as a walk-in does. Undoing the check-in puts the old time back.
- `movesFrom(status, onItsDay)` in `lib/domain.ts` decides what to offer. On a no-show's day, "Check in (arrived late)" leads, ahead of "Restore booking". The doctor and desk visit pages and the API's `nextStatuses` use it.
- The 15-minute rule (`lib/no-show.ts`) is unchanged.

## Why
A patient assumed not to be coming who turns up later the same day had to be restored to a morning time that had passed, then checked in at it.

## Tested
- `tsc --noEmit` and `eslint` clean. Not run against the database: no demo no-show today.
