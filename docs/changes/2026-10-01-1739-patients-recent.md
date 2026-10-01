# Patients list: recent patients under upcoming

Opened: 2026-10-01 17:39 PHT

**What:** when fewer than seven patients have visits coming, the doctor's Today Patients list fills the rest with patients seen lately (each once, at their last visit that happened: completed, or checked in / in consultation), under a "Recent" label with "Seen Sep 30". Choosing one shows their last visit details.

**Why:** the user saw a single row when only one patient had visits booked.

**Tested:** `tsc`, eslint; screenshot (Ramon upcoming, then three recent).
