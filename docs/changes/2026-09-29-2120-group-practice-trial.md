# Seed a test group practice

Opened: 2026-09-29 21:20 PHT

## What
- `npm run db:seed-group-practice`: Magsaysay Group Clinic with two verified
  doctors (different hours), one desk, and a patient of each doctor booked for
  tomorrow. Prints each patient's activation code. Safe to run again.

## Why
To find what breaks with more than one doctor per clinic before phase 5.
Findings: medfave-design `plans/group-practice-findings.md`.

## Tested
- Ran it against the dev DB (twice; it replaces the earlier clinic).
- Signed in as both doctors and the desk; activated a patient and sent a
  request through the API. Results are in the findings doc.

## Heads-up
- Accounts: group.doctor1@, group.doctor2@, group.desk@medfave.com, password
  `password`. Dev data only.
