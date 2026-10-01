# Clinic settings in the shared frame, stronger form sections, 6-box code on the web

Opened: 2026-10-01 11:29 PHT

**What:**
- `/manage` (clinic settings) uses `AppShell` like the doctor and desk sides: sidebar on wide screens, pill bar on phones (Clinic, Details, Schedule, Staff, Admin, Consulting room, as they apply). `AppShell` takes `narrow` for form-width pages.
- Nav link data moved to `components/nav-links.ts`: a `"use client"` file only gives server layouts references, not values, which broke `/manage`.
- Form section titles across `components/forms/*` (Visit, Schedule, Details, Clinic use, Vitals…) are now Jakarta headings with a fuchsia bar.
- New `components/code-input.tsx`: six digit boxes (type, paste, autofill, arrows/backspace) on web sign-up (`/register`) and Add a clinic. A long code from a link still shows as a plain field.
- Doctor Today: the follow-up date no longer overlaps the patient's name.

**Why:** the user asked to finish the redesign (settings and forms) and for the OTP-style code on the web too.

**Tested:** `tsc`, eslint; screenshots of `/manage` and `/manage/schedule` (doctor) at 390 and 1280px, `/dashboard`, desk forms, and `/register` with 482915 typed (posted value checked).
