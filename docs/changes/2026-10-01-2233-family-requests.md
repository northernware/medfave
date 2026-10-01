# Family list, and requests for somebody else

Opened: 2026-10-01 22:33 PHT

## What
- New `FamilyMember` table: the people a login books for (name, birthday, sex, relationship), kept on the account. It grants nothing at any clinic. Managed by `lib/family.ts` and `/api/v1/family`.
- `AppointmentRequest` gains `forOther`, `newRelationship` and `familyMemberId`. `POST /discover/requests` takes `familyMemberId`. If the login already looks after that person's chart at the clinic, that chart is used; otherwise it's a new-patient request with their details prefilled.
- Accepting a request **for somebody else** creates or links the chart, then makes the requester a caregiver (`CareLink`). It never sets the chart's own login. A new chart joins the requester's household at that clinic, when they have one, with the relationship given.
- Desk and the doctor API show "Asked by Ana Santos, their child". The desk's existing look-alike suggestions apply as before.

## Why
"Bring family along": book for a child or parent without making their chart yours. This also fixes a new-patient request made for someone else linking the new chart as the requester's own.

## Tested
- `tsc` and `eslint` are clean. The migration is additive only.
- Results of the dev-DB run are below.

## Not done / next
- Mobile: a My family screen, and "Who is this for?" on Find a doctor requests.
- Web: there's no My family page yet, because new-patient requests come from the app.
- Ticking several people in one request: for now it's one request per person.

## Heads-up
Migration `family_requests`: run `npm run db:migrate` after pulling.
