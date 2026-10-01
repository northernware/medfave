# Patients cancel and move their own visits

Opened: 2026-10-01 14:22 PHT

**What:**
- `Clinic.patientCancelHours` (default 2): patients may cancel a visit themselves until that many hours before it. Set on the web (Clinic details → Cancelling) or via `PUT /doctor/clinic-settings { patientCancelHours }`.
- `lib/patient-visits.ts`: `cancelByPatient` (own visit, PENDING/CONFIRMED, before the cut-off; notes it in internal notes; withdraws a pending move). `POST /patient/appointments/:id/cancel`.
- Moving is a request: `POST /patient/requests { …, rescheduleOf }` (`AppointmentRequest.rescheduleOfId`), same doctor, one at a time. On acceptance the new visit is booked (the clash check ignores the old one) and the old one is cancelled with a note.
- `GET /patient/appointments` gives `canCancel`, `cancelBy`, `canMove`, `movePending` and `cancelHours`. Desk requests and `GET /doctor/requests` show a move as "Move from …" (`moveFrom`).

**Why:** the user asked for patients to reschedule or cancel themselves; the clinic sets the cancel cut-off, and moves go through the clinic.

**Tested:** see the PR's later notes.

**Heads-up:** migration `20261001T0619_patient_cancel_move` (additive: `Clinic.patientCancelHours`, `AppointmentRequest.rescheduleOfId`).
