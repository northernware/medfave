# Date fields stay inside their card on iPhone

Opened: 2026-10-02 04:28 PHT

## What
- `app/globals.css`: date, date-time and time inputs drop iOS Safari's built-in minimum width and appearance, so they fit their column like other fields. Their text is left-aligned.

## Why
On an iPhone, "Visit date and time" and "Follow-up date" on Consultation notes stuck out past the card's edge.

## Tested
CSS only. Not checked on an iPhone yet.
