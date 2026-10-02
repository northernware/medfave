# Second emergency contact; address and primary care on the emergency card

Opened: 2026-10-02 14:41 PHT

## What
- `Patient.emergencyContact2Name`, `emergencyContact2Relationship` and `emergencyContact2Number`: a second contact, in the patient form (doctor and desk) and shown on both chart pages.
- `lib/emergency.ts` / `GET /patient/emergency`: each clinic record adds `address` (the household's), `contacts[]` (first, then second) and `physician` (`{ name, specialty, phone, clinicName }`). The physician is the doctor who saw them last there, else their household's doctor. The phone is the clinic's. `general` adds `address` and the physician from the most recently visited clinic, and its `contacts` include both.
- Portal Emergency card shows Address and Primary care.

## Why
The user set out the card: name and DOB, address, first and second emergency contact, allergies, conditions, medications, and primary care physician with specialty and phone.

## Tested
- `tsc` and `eslint` are clean.
- Results of the dev-DB check are below.

## Heads-up
Migration `emergency_contact_2`: run `npm run db:migrate` after pulling.
