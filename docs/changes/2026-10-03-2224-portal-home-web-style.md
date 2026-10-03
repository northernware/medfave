# Patient portal Home in the clinic web's style

Opened: 2026-10-03 22:24 PHT

## What
- `/portal` is redone in the style of the doctor and desk pages, replacing the app-style layout from #138:
  - a figures strip: next visit ("In 2 days", with date and service), upcoming visits, requests waiting, documents;
  - cards with list rows and dot badges.
- Kept from #138:
  - cancelled and missed visits fold under one row;
  - a status shows only when it isn't Confirmed;
  - a move request reads "Move to …" and "now …";
  - the clinic's note shows on a declined request;
  - past visits show the face given.
- The `--hero` colour from #138 is removed.

## Why
Owner: the portal should match the clinic's web pages, not the phone app. #138 misread that.

## Tested
- `tsc --noEmit` and `eslint` clean; signed in as the demo patient on the local dev server, 1280 px, dark.
