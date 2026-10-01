# Return visits start from the last note; breadcrumbs on every sub-page

Opened: 2026-10-02 04:22 PHT

## What
- **Document visit** pre-fills from the patient's latest finalized note that this doctor may read (their own, or any note in a shared-chart clinic). It copies the assessment, treatment plan, prescriptions and height. Chief complaint, history, the other vital signs and examination always start blank. A banner says which visit it came from, with **Start blank** (`?fresh=1`).
- `components/breadcrumbs.tsx` in `AppShell`: a trail such as "Patients › Patient › Edit" on every page below a section, built from the URL. It links only to pages that exist. Phones get a single "‹ Patients" back link. Section pages show nothing.

## Why
The user asked: follow-ups re-type the same diagnosis, plan and medicines; and moving between pages needed a way back.

## Tested
`tsc` and `eslint` are clean. Not clicked through.

## Not done / next
- Crumbs name an id by its kind ("Patient", "Visit"), not by the person.
- Loading skeletons, to make clicks feel instant, are still to do.
