# Accounts keep first, middle and last name

Opened: 2026-10-01 16:57 PHT

**What:**
- `Account.firstName`, `middleName`, `lastName` (nullable). Every account write stores them with `fullName` (their join): sign-up, Google sign-up, activation, staff invite, and the account page. `lib/names.ts` `namePartsOf` takes the parts as sent, or guesses from a full name (title dropped, last word as last name) for older clients.
- The account page edits the name as First / Middle / Last (`NameFields` with stored defaults).
- Greetings use the stored first name ("Ma. Teresa" stays whole), falling back to the first word.
- `npm run db:backfill-names` fills the parts for existing accounts from their full name (a best guess; people correct it on the account page). Run once.

**Why:** the user asked to finish the name split, including editing.

**Tested:** see the PR's later notes.

**Heads-up:** migration `account_name_parts` (additive, three nullable columns); then `npm run db:backfill-names` once on the shared database.
