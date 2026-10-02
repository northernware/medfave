# Looked after by: one tap for a parent already on Medfave

Opened: 2026-10-02 13:58 PHT

## What
- The desk's **Looked after by** card suggests grown-ups in the same household who use Medfave ("Ramon Dela Cruz · Head of household · uses Medfave **[Give access]**"). One tap links them, with no code. The child is in their My family straight away.
- **Their Medfave email** links anyone else on Medfave the same way.
- Making a code is now the fallback, under "Not on Medfave yet? Give them a code", and the name is optional.
- `grantCareByStaff` in `lib/caregivers.ts`, and the `giveCareAccess` action.

## Why
The user found it clumsy: typing a name and then showing a QR, for a parent who is standing at the desk and already has the app.

## Tested
- `tsc` and `eslint` are clean.
- On the dev DB: linking Ramon to Sofia by account worked, and Sofia showed in his family as Child (linked). An unknown email was refused. Undone afterwards.
