# The emergency card on the web, as a card

Opened: 2026-10-02 18:02 PHT

## What
- `components/emergency-card-face.tsx`: the same landscape card as the app (red band, white logo, blood type, name and address, primary/secondary contacts, allergies/conditions/medications one per line, primary care physician), sized in `cqw` so it scales with its container.
- The portal's Emergency card page leads with the card; the lists move under **Full details**. **Print or save as PDF** gives a clean card (the sidebar and header were already hidden in print), and **Share** uses the phone's share sheet, falling back to copying the link.
- `--emergency` (#C62828, medfave-design's `emergencyRed`) added to `globals.css`, restricted to emergency information. `Lockup` takes `tone="white"` for a coloured ground.

## Why
Item 2 of what the user asked for: the web still showed only a list.

## Tested
- `tsc` and `eslint` are clean. `faceOf` was run against the dev DB: all four Dela Cruz cards shape correctly, with Lia's severe penicillin allergy flagged.
- Not opened in a browser; the print layout needs a look.
