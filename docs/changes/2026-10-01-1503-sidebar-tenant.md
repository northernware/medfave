# Sidebar for a multi-clinic platform; Solar icons; squircle corners

Opened: 2026-10-01 15:03 PHT

**What:**
- `AppShell` (doctor, desk and clinic settings) rebuilt: the clinic switcher at the top (`ClinicSwitcher`; lists "Your clinics" with the current one ticked, ready for doctors at several clinics), a **Doctor / Front desk / Settings** view switch (`ViewSwitch`, by role) instead of a "Front desk" link, sections in groups (Practice, Patients, Clinic…), and the person at the foot with a menu (`ProfileMenu`: Account, Theme, Sign out). On phones: clinic and avatar in the bar (same menus), the view switch, and pill sections.
- Icons are Solar (`@solar-icons/react`, linear), named by key in `components/nav-links.ts` and drawn in `components/nav.tsx`.
- Squircle corners: `app/globals.css` sets `corner-shape: squircle` (pills stay round) with slightly larger radii where the browser supports it; others keep rounded corners.

**Why:** the user wanted the web to look like a multi-tenant platform (reference design), with a clinic switcher ready for phase 6, a view switch, a profile popup, Solar icons and iOS-like shapes.

**Tested:** `tsc`, eslint; screenshots of the doctor dashboard (1280px) and desk Today (390px), no sideways scroll.

**Not done / next:** switching between clinics does nothing yet (one clinic per login until phase 6). Page content still uses its own inline icons.

**Heads-up:** new dependency `@solar-icons/react`.
