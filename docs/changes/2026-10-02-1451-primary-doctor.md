# Primary care physician: the regular doctor, or the patient's choice

Opened: 2026-10-02 14:51 PHT

## What
- The card's physician is no longer "whoever saw them last". It's the doctor the patient (or a caregiver) chose, else the one who saw them most in the past year (the more recent on a tie), else their household's doctor. On the combined card, the choice wins; otherwise the most-seen doctor across clinics.
- `Patient.primaryDoctorId` holds the choice on one chart, and the person's other charts are cleared. `POST /patient/emergency/physician`, plus a chooser on the portal Emergency card ("Work it out" or any doctor who has seen them).
- Emergency contacts are labelled **Primary** and **Secondary** in the forms, on the charts and on the cards.

## Why
The user pointed out that a one-off visit to a specialist shouldn't become someone's primary care physician, and asked for Primary/Secondary labels.

## Tested
- `tsc` and `eslint` are clean.
- Results of the dev-DB check are below.

## Heads-up
Migration `primary_doctor`: run `npm run db:migrate` after pulling.
