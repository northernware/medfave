# Patient portal Home matches the app

Opened: 2026-10-03 22:19 PHT

## What
- `/portal` is laid out as the app's Home and Visits:
  - the next live visit as the deep-pink card ("Next visit · In 2 days", service, doctor, date and time pills, the brand heart); new `--hero` / `bg-hero` colour, deep pink in both themes;
  - Upcoming as white cards, two a row on wider screens, status leading the top line ("Pending · In 9 days"); cancelled and missed fold under "N cancelled or missed";
  - Requests: waiting ones first, then the latest answers, as the app's request cards, with "From … to:" for moves, the clinic's note in a panel, and "Withdraw" or "Keep my current time";
  - "From your clinic" documents;
  - Past visits with the face the patient gave (`RatingFace`), or Missed / Cancelled.
- The contact-details card is gone from Home; it lives on My details.

## Why
Owner: the portal no longer fitted the look the app now has.

## Tested
- `tsc --noEmit` and `eslint` clean. Signed in as the demo patient on the local dev server at 1280 px wide, dark. Light mode and phone width not checked.

## Not done / next
- Rating from the web: the faces only show here; rating is in the app.
- The portal's other pages (Request a visit, Documents, Emergency card, My family) are unchanged.
