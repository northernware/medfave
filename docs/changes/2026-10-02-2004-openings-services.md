# API: openings for several people with different kinds of visit

Opened: 2026-10-02 20:04 PHT

## What
- `GET /patient/clinic/openings?services=A,B,C`: several people seen back to back, one kind of visit each, in order. `minutes` is the total, and only starts where the whole run fits are listed (a back-to-back run fits exactly when the whole block is free). Unknown kind → 400. Reply also echoes `services`. `docs/api.md` updated.
- `openingsFor` takes one service or a list.

## Why
The app's request form lets each person have their own kind of visit.

## Tested
- `tsc`, `eslint` clean. Dev DB, Mon 5 Oct: 30 → 60 → 75 min runs lose starts that would cross the lunch break, the 13:30 booking or closing; `services=NOPE` → 400.

## Not done / next
- Nothing.
