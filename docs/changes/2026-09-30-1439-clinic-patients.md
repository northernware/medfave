# Patients are the clinic's: details, chart and notes in three layers

Opened: 2026-09-30 14:39 PHT

## What
Phase 5, part 3 (medfave-design `plans/group-practice-findings.md`, decision 2).
No migration: patients already had a clinic; what changed is who reads what.
- **New `lib/care.ts`:** a doctor **cares for** a patient once they've
  registered them (household is theirs), booked, seen, written about, or been
  asked for by them. `caredForIds`, `caresFor`, `idsOrNone`.
- **Three layers:**
  1. **Details** (name, birthday, contact, household): every doctor and the
     desk at the clinic.
  2. **Chart** (allergies, conditions, medications, alerts): doctors caring
     for the patient.
  3. **Visit notes:** only their author.
- **Patients list:** "Mine" (cared for) by default, "Everyone at the clinic"
  one tap away; patients not yet yours show "Not yet your patient" instead of
  allergy badges.
- **Patient page:** a doctor not caring for the patient gets a details-only
  view with **Book**; booking them opens the chart. Visit history lists only
  the viewing doctor's notes. Editing the chart, archiving, restoring and
  deleting need care (page and actions). "Can delete" still counts everyone's
  notes.
- **Households are the clinic's:** lists, pickers and household pages are
  clinic-wide; member visit counts are the viewer's, allergy badges only for
  members they care for.
- **Booking** offers every patient of the clinic; **clinical pickers**
  (documents) offer cared-for patients; **writing a note** accepts any clinic
  patient (it starts care). Dashboard counts are the doctor's own.

## Why
Agreed decision: patients book a doctor, not a clinic; details belong to the
clinic, notes to their author; allergies and alerts in the chart layer.

## Tested
- `tsc` and `eslint` pass.
- Group practice (Teresa given a severe penicillin allergy and a visit note by
  Dr. Ramos), 11 checks pass: Dr. Lim's "Mine" shows only Miguel; "Everyone"
  shows both, Teresa marked not his, no allergy shown; opening Teresa is
  details-only with Book and no allergy or note; he can't edit her chart; he
  can book any clinic patient; once booked he sees her allergy but not Dr.
  Ramos's note; Dr. Ramos still sees his note; households are clinic-wide;
  the desk sees all patients and never notes.
- The solo demo clinic is unchanged (8 mine = 8 at the clinic).

## Not done / next
- The shared-charts setting (opens layers 2–3 to every doctor) and the log of
  who opened which chart: plug in at `lib/care.ts`.
- Inviting a doctor.

## Heads-up
- Checking access to a patient now means `caresFor` (chart) or the clinic
  (details) — not `household.doctorId`. Don't reintroduce household-owner
  filters.
