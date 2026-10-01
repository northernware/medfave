# Booking requests: Decline lines up on new-patient rows

Opened: 2026-10-02 04:11 PHT

## What
- On a new patient's request, the **Their record** choice now sits above the action row. It's still submitted with Accept, through the `form` attribute. Time, Accept, Reason and Decline line up the same on every row; before, Decline was pushed to the far right.

## Why
A visual glitch the user spotted on the desk's Booking requests page.

## Tested
`tsc` and `eslint` are clean. Not clicked through.
