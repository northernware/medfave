# Doctor's Today in the reference layout

Opened: 2026-10-01 15:28 PHT

**What:**
- Doctor pages use the window's width (`AppShell wide`, up to 1680px).
- `/dashboard`: stat tiles as separate cards; **Patients list** (upcoming visits, soonest first; the selected one dark, `?visit=`) beside **Last visit details** (the patient's latest note by this doctor: allergies, complaint chips, assessment, plan, prescriptions, follow-up); right column **schedule** (week strip, today as a timeline with a now line, Check in / Start on each visit). Waiting room, unfinished notes, follow-ups due and missed stay below. Panels in `app/(app)/dashboard/panels.tsx`.
- Only the doctor's own notes show in Last visit details (notes are their author's).

**Why:** the user liked the reference's schedule column, patients list and last-visit panel, full width.

**Tested:** `tsc`, eslint; screenshots at 1440px and 390px as the demo doctor, no sideways scroll.
