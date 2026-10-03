# Faves and after-visit feedback

Opened: 2026-10-03 20:09 PHT

## What
- Migration `20261003T1206_faves_and_visit_feedback` (additive only): `Fave` (login ↔ doctor, unique pair), `VisitFeedback` (one per visit and login; `rating` GOOD / NOT_GREAT or null for "closed"; `note`), and the enum `VisitRating`.
- `lib/faves.ts`: list, set and check faves; the visit to ask about (latest completed visit in 14 days with no feedback); save feedback.
- API: `GET /faves`, `PUT|DELETE /faves/:doctorId`, `GET /patient/after-visit`, `POST /patient/appointments/:id/feedback`. `/discover/doctors/:id` adds `faved`. Documented in `docs/api.md`.

## Why
PRODUCT.md decision 6 (medfave-design #19): a private fave and clinic-only feedback after a visit, not public ratings.

## Tested
- `tsc --noEmit` and `eslint` clean. Migration planned from the latest snapshot (`daa1a904`); applied to the dev database with `db:migrate` before merging; endpoints exercised against it after deploy.

## Not done / next
- Where the clinic reads feedback (web): not built yet.
- The public fave count on doctor profiles: later, with discovery.

## Heads-up
- New migration: run `npm run db:migrate` on any other database.
- `migrations/app/refs/db.json` points at an old contract (`6dc60cf…`). Plain `db:plan` started from it and tried to recreate existing tables, so I planned with `--from daa1a904…`. That ref needs fixing.
