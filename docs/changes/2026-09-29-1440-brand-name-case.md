# "Medfave" with a capital M in text

Opened: 2026-09-29 14:40 PHT

## What
- Page titles, landing page, privacy notice, sign-in/sign-up/welcome/verify pages,
  desk QR text, share message, every email subject and body, error messages
  and the logo's screen-reader label now say "Medfave".
- The email header "♥ medfave" stays lowercase: it stands in for the logo.
- Comments, README, `docs/api.md` and AGENTS.md follow the same rule.

## Why
The name reads as a proper noun in sentences, titles and messages. The
lowercase wordmark is the logo's style, not the spelling. Rule written in
medfave-design's README ("Writing the name") and every repo's AGENTS.md.

## Tested
- `npx tsc --noEmit` and `npx eslint .` pass.
- Grepped for capitalised technical names (`Medfave://`, `@Medfave`,
  `Medfave-app`, `Medfave.session`): none. Not clicked through in a browser.

## Not done / next
- Historical notes in `docs/changes/` are left as written.

## Heads-up
- New convention: write **Medfave** in any user-facing text. Keep lowercase
  for the logo, `medfave://`, addresses (`@medfave.com`), repo names and
  code/storage names.
