# One login, many clinics

Opened: 2026-09-28 21:54 PHT

## What
- **Schema:**
  - `Patient.accountId` is no longer unique. It's unique per clinic instead (`@@unique([accountId, clinicId])`), with an index.
  - `Account.patientProfile` becomes `patientProfiles`.
  - Migration: `20260928T1333_one_login_many_clinics`.
- **Viewer:** `viewer.patient` becomes `viewer.charts`, one per linked clinic, with the clinic name. `patientContext(viewer, clinicId)` picks one chart, and `CurrentPatient` gains `clinicName` and `charts`.
- **Web portal:**
  - a clinic bar under the header to switch clinics (remembered in the `portal_clinic` cookie);
  - a new **Add a clinic** page (`/portal/add-clinic`) that redeems another clinic's code.
- **API:**
  - patient endpoints take `?clinic=` or `X-Clinic-Id`;
  - new `GET` and `POST /patient/clinics`;
  - `/me` returns `charts`;
  - `role` now prefers `doctor` over `patient`.
- **Sign-in:** `linkPatientActivation` in `lib/sign-in.ts` shares the code checks with first activation. Activating with an email that already has an account now says to sign in and add the clinic.
- **Dev seed:** `npm run db:seed-second-clinic` creates Riverside Health Center (`doctor2@medfave.com` / `password`), with a chart there for Ramon Dela Cruz, and prints an activation code for it.
- `docs/api.md` is updated.

## Why
`PRODUCT.md` decision 4: a patient who goes to a second clinic keeps one login, and each clinic's records stay its own.

## Tested
- `tsc` and eslint pass. `db:verify` reports that the database schema satisfies the contract.
- **20 API checks** against the dev database, all passing:
  - adding a clinic with a bad code, a good code, and the same code again;
  - `/me` and `/patient/clinics` list both clinics;
  - appointments for each clinic, by query and by header, and 404 for an unlinked clinic;
  - a request sent to Riverside reaches only Riverside's doctor and was withdrawn;
  - each doctor sees only their own clinic's chart, and 404 opening the other's.
- **Web portal, in a browser:**
  - the clinic bar switches between the two clinics, each showing its own chart;
  - the details, request and add-clinic pages all load.
- No console errors.
- **Not tested:** a doctor account that is also a patient elsewhere (role precedence). The web add-clinic form's submit was covered by the API tests, not clicked in a browser.

## Heads-up
- **The dev database was reset in the process.** Eight tables that had been pushed there from a branch that isn't on GitHub (`Invoice`, `InvoiceLine`, `Payment`, `PriceItem`, `BillingCounter`, `LabOrder`, `LabResult`, `Notification`) and three enums were dropped, with the owner's go-ahead. All were empty; structure backups exist. **If you own that work, push it as a branch with a migration.**
- `migrations/app/refs/db.json` now points at this schema (`6dc60cf…`).
- The dev database already has this migration's schema. `db:migrate` on another database applies it normally.
