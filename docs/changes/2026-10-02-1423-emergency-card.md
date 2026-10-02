# Emergency card (read-only, from the clinics)

Opened: 2026-10-02 14:23 PHT

## What
- `lib/emergency.ts`: a card for the patient and each person they look after: blood type, allergies (reaction, severity), medicines, conditions and emergency contact, straight from the clinics' records.
  - **General:** every clinic's record side by side, each item saying which clinic it came from. Every allergy from every clinic is included, with the worst severity kept. Clinics that disagree on blood type are flagged ("⚠ Clinics disagree").
  - **Per clinic:** that clinic's record as it stands, with when it was updated.
- `GET /patient/emergency`, and a portal **Emergency card** page (sidebar, heart-pulse icon) with Me / family tabs and General / per-clinic tabs.
- Read-only: "Something wrong? Ask the clinic."

## Why
The user asked about the Medfave card. This is the read-only first step: it needs no decision about patients editing the card or syncing it. The rest stays an open question in PRODUCT.md.

## Tested
- `tsc` and `eslint` are clean.
- On the dev DB, Ramon's cards: his own (O+, no known allergies, Amlodipine, hypertension, Marilou as contact), Joaquin's (O+, dust and pollen allergies, asthma) and Lia's (nothing recorded yet).

## Heads-up
Patients and caregivers can now see the clinic's allergy, medicine and condition lists. The clinicians' notes are still not shown.
