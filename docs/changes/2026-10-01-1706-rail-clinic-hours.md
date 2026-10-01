# Schedule timeline spans the clinic's hours

Opened: 2026-10-01 17:06 PHT

**What:** the schedule panel's hours (Today, Calendar, desk Today) follow the clinic's opening hours for the day shown (`openingHours` prop): e.g. Saturday 9–12. A visit outside them widens the span. A closed day with nothing booked says "Closed this day." A clinic without its own hours uses the doctor's week (doctor pages) or 8–5 (desk).

**Why:** the user asked for the times to follow the clinic's schedule.

**Tested:** `tsc`, eslint; Calendar screenshots for Saturday (9 AM–12 PM) and Sunday (closed).
