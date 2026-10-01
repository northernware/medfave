# Calendar fits on wide screens again

Opened: 2026-10-01 15:33 PHT

**What:** removed the calendar page's `2xl:-mx-16` (negative margins that widened it inside the old narrow container). With doctor pages now full width it pushed the calendar past the window on screens ≥1536px, under the sidebar, with sideways scroll.

**Why:** the user reported the calendar width broke.

**Tested:** at 1920px no element extends past the window; 1440, 1100 and 390px checked by screenshot.
