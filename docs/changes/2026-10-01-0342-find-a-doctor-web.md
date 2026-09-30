# Find a doctor on the web welcome page

Opened: 2026-10-01 03:42 PHT

**What:**
- New `components/find-doctor.tsx`: search over listed, verified doctors (same `searchDoctors` as the app), a plain GET form (`?q=`). Results link to the clinic page `/c/<slug>`.
- `/welcome` for a patient now leads with Find a doctor. The activation code is a collapsed "Have a code from your clinic?" (opens by itself when `?code=` is present).
- Removed the out-of-date "Finding a clinic … is coming soon".

**Why:** new patients read the welcome page as "you need a code", though finding a doctor already works.

**Tested:** `tsc` and eslint. Not checked in a browser while signed in as a new patient.

**Not done / next:** asking for a visit is still app-only; the clinic page sends people to the app. No specialty filter on the web yet.
