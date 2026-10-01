# Page headings breathe; calendar fills the window

Opened: 2026-10-01 16:47 PHT

**What:**
- `PageHeader` on wide screens: 20px above (the title lines up with the sidebar's logo), 8px below, 4px in. Every page using it gets this.
- Calendar: on wide screens the month card fills the window to the bottom edge, rows sharing the height (`repeat(weeks, 1fr)`), cells clipping overflow.
- Calendar: the last week's cells no longer draw a bottom border on top of the card's own (the double line).

**Why:** the user asked for headings with room, the calendar to reach the bottom, and reported the extra line.

**Tested:** `tsc`; screenshots of Calendar and Today at 1440×900.
