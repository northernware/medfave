# Undoing a check-in: say whose slot it is now

Opened: 2026-10-03 19:46 PHT

## What
- `changeAppointmentStatus` returns, on a clash, who has the time and when (`clashWith`, `clashAt`), and whether it was an undo putting a visit back (`restoring`).
- `POST /doctor/appointments/:id/status` uses them: "Can't put this visit back: October 5, 2026, 9:00 AM is Corazon Dela Cruz's now. Leave it checked in, or move it to a new time." Before, it was a generic "booked by someone else" message.

## Why
Owner hit this on the phone. Checking in early frees the old slot; it was given to another patient, and undoing the first check-in then had nowhere to go. The refusal was right; the message didn't say why.

## Tested
- `tsc --noEmit` and `eslint` clean. The clash case wasn't re-run against the database.

## Not done / next
- Open question: should an early check-in keep holding its old slot until the visit is completed? That would stop this case from happening at all.
