# Visit feedback: a 1–5 score and tags

Opened: 2026-10-03 20:18 PHT

## What
- Migration `20261003T1217_feedback_score_tags` (additive): `VisitFeedback.score` (1–5) and `tags` (codes, comma-joined).
- `POST /patient/appointments/:id/feedback` takes `{ score, tags[], note }`. `rating` is derived from the score (4–5 GOOD, 1–3 NOT_GREAT), and sending `rating` alone still works for the app's first version. The tag codes are in `FEEDBACK_TAGS` (`lib/faves.ts`) and `docs/api.md`.

## Why
Owner wants a rating sheet with faces and quick tags (a modal) in place of the good / not-great card.

## Tested
- `tsc --noEmit` and `eslint` clean; migration applied to the dev database with `db:migrate` before merge.

## Heads-up
- New migration: `npm run db:migrate`.
