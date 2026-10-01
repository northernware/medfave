# Settings out of the view switch; schedule timeline line

Opened: 2026-10-01 16:11 PHT

**What:**
- The view switch is only **Doctor | Front desk** (`VIEWS`); an administrator sees no switch. Clinic settings moved to the clinic menu (the clinic's name, for those who may change it) and a "Clinic settings" link in the sidebar's Clinic group (doctor) or after the desk's sections (administrator/doctor at the desk). Inside clinic settings a "Back to Today" (doctor) or "Back to the front desk" (administrator) link replaces the switch. `AppShell` takes `settingsHref` and `back`.
- Dashboard schedule: a vertical line runs through the hour labels; the live time shows AM/PM (e.g. "4:11 PM") in an accent pill on that line, with its horizontal line running the full width (left of the pill too).

**Why:** the user agreed Settings didn't belong with the two ways of working, and asked for the timeline line and AM/PM.

**Tested:** `tsc`, eslint; screenshots of the dashboard schedule and `/manage` as the demo doctor.
