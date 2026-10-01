# API: breaks, closures and visit lengths for the app

Opened: 2026-10-01 11:33 PHT

**What:**
- New `lib/schedule.ts` (`addBreakFor`, `removeBreakFor`, `addClosureFor`, `removeClosureFor`, `saveServiceLengthsFor`): the rules moved out of `app/actions/schedule.ts`, which now calls them. Same validation and writes.
- New `/api/v1/doctor/schedule` (GET / POST / DELETE), documented in `docs/api.md`.

**Why:** doctors should manage their whole schedule from the app (mobile-first).

**Tested:** `tsc`, eslint. Web schedule page behaviour unchanged by construction; exercised through the app next.
