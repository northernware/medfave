# A caregiver code per person

Opened: 2026-10-01 22:14 PHT

## What
- Issuing a caregiver code no longer revokes other unused caregiver codes, so Mom's and Dad's codes can both be out at once. A patient's own code still replaces the previous one.
- **Looked after by** lists every live caregiver code, each with its own Revoke (`activationId`).

## Why
Two parents looking after one child: the second code was cancelling the first before it was redeemed.

## Tested
`tsc` and `eslint` are clean. Not clicked through.

## Not done / next
- The mobile person switcher (medfave-mobile).
