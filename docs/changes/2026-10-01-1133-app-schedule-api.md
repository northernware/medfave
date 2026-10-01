# API: breaks, closures and visit lengths for the app

Opened: 2026-10-01 11:33 PHT

**What:**
- New `lib/schedule.ts` (`addBreakFor`, `removeBreakFor`, `addClosureFor`, `removeClosureFor`, `saveServiceLengthsFor`): the rules moved out of `app/actions/schedule.ts`, which now calls them. Same validation and writes.
- New `/api/v1/doctor/schedule` (GET / POST / DELETE), documented in `docs/api.md`.

**Why:** doctors should manage their whole schedule from the app (mobile-first).

**Tested:** `tsc`, eslint; against the local dev server as the demo doctor: GET, add break, a bad break (422 "Has to end after it starts"), add closure, set and reset lengths, delete both, 404 for an unknown id. Test rows removed. The web schedule page was not clicked through after the move.
