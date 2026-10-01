# Repeating days off

Opened: 2026-10-01 11:53 PHT

**What:**
- `ClinicClosure.repeat`: "NONE" (default), "WEEKLY", "MONTHLY" or "YEARLY". The same stretch repeats from its first day until removed.
- `lib/availability.ts`: `closureCovers()` decides whether a closure (repeats included) covers a day; `fullDayClosure` and `blockedIntervals` use it, so booking, slots and the app all honour repeats. A month without that date (the 31st) skips that repeat.
- Writer (`lib/schedule.ts`) takes `repeat` and refuses a stretch too long to repeat (at most 6 days weekly, 27 monthly, 364 yearly).
- Web schedule page: "Repeats" select; the list says "every week/month/year" and keeps repeating closures after their first run. API `/doctor/schedule` takes `repeat` and lists them the same way.

**Why:** the user asked for days off to be repeatable.

**Tested:** `tsc`, eslint; 15 unit cases for `closureCovers` (weekly, multi-day weekly, month-end skip, monthly run across a month boundary, yearly across new year, before the first day).

**Heads-up:** migration `20261001T0351_repeating_closures` (additive: a text column with default "NONE"). Existing closures are unchanged.
