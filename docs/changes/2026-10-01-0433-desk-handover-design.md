# Desk: activation handover redesigned

Opened: 2026-10-01 04:33 PHT

**What:**
- The "hand it over" panel on a desk patient page is now a brand card (blush header, fuchsia-framed QR, the 6 digits in boxes like the app's code field), with far less text.
- Sending later (Share… / Copy message, 14-day link) sits in a footer row.
- "Copy code" is gone: it copied the long code, which confused things next to the 6 digits.

**Why:** the user found the green success panel ugly and off-theme.

**Tested:** `tsc`, eslint; screenshots of the desk patient page in light and dark (rendered with a test `?code=&pin=`).

**Not done / next:** the rest of the front desk UI is still to be looked at (user: "maybe the whole front desk ui is not looking good").
