# Patient visits carry the doctor's id

Opened: 2026-10-01 14:27 PHT

**What:** `GET /patient/appointments` adds `doctorId` to each visit, so the app can load that doctor's hours when the patient moves a visit.

**Why:** the app's Move button (medfave-mobile, patient cancel/move).

**Tested:** `tsc`.
