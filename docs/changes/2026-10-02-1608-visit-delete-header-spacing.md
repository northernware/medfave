# Visit deletion placement and header spacing

Opened: 2026-10-02 16:08 PHT

## What
- Place Delete appointment beneath the main visit card, so History's height does not push it down.
- Remove the shared page header's extra 20px desktop top padding, leaving the 12px breadcrumb gap.

## Why
The delete row looked misplaced below History, and breadcrumbs were too far from the page heading.

## Tested
- `npm run typecheck`, targeted ESLint, and `git diff --check` passed.
- Not visually verified in a browser.

## Not done / next
- Check the layout in a running browser.
