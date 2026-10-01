# Start household: unique name, adults only

Opened: 2026-10-02 03:34 PHT

## What
- The new household's name no longer clashes with the one being left. Names are unique per doctor, so a taken "Dela Cruz" becomes "Dela Cruz (Lia)", then gets a number if needed. Before, the clash was refused by the database, and the desk saw "Something went wrong".
- Only adults (18 and over) can start their own household. The option is hidden for children, and the server refuses it too.

## Why
Found in testing: starting a household for Lia, 6, crashed on `Household_doctorId_name_key`, and it shouldn't have been offered for a child at all.

## Tested
- `tsc` and `eslint` are clean.
- Reproduced the crash on the dev DB in a rolled-back transaction. The fixed action has not been run.
