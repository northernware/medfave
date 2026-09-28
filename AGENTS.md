<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Change notes — required for every developer and every agent

Every push that opens or updates a pull request includes a change note in
`docs/changes/`. That applies to every developer and to every agent (Claude,
ChatGPT or Codex, or any other). The notes are how the rest of the team, and
their agents, know what's going on. **Read the newest few before you start
work.**

- **One file per pull request:** `docs/changes/YYYY-MM-DD-<short-slug>.md`,
  dated the day the PR opens. When you push more to the same PR, update that
  file rather than adding another.
- **Write it before you push, in the same PR,** with these sections:
  - **What:** what changed, in a few bullets.
  - **Why:** the reason, or the request it answers.
  - **Tested:** what was checked and how. Say plainly what wasn't.
  - **Not done / next:** loose ends, follow-ups, open questions.
  - **Heads-up:** anything that changes how others work, such as new env
    vars, migrations, renamed routes, new conventions or new dependencies.
    Leave it out when there's nothing.
- **Keep it short.** The diff has the detail. Write for a developer or agent
  picking this up cold.

`docs/changes/README.md` repeats this for anyone who lands there first.

## Product direction

Before planning a feature, read `PRODUCT.md` in
[northernware/medfave-design](https://github.com/northernware/medfave-design)
(`../medfave-design/PRODUCT.md` when cloned beside this repo): what medfave is
for, the business model, the build order and the decisions still open. Don't
build as if an open decision were settled.

## Mobile API

The mobile app talks to this app through the JSON API under `app/api/v1`,
documented in `docs/api.md`. Keep that file in step with every change to the
API. Business rules live in `lib/` (`lib/sign-in.ts`, `lib/requests.ts`) and are
shared by the server actions and the API routes; don't copy a rule into a
route handler.

## Brand and design reference

The medfave look is defined in a separate repo,
[northernware/medfave-design](https://github.com/northernware/medfave-design),
which serves both this app and `medfave-mobile`. Check it before any UI work,
and clone it beside this repo (`../medfave-design`) if it is not there.

- `tokens/tokens.json` is the source of truth for colour, type, spacing and radius.
  This app maps them onto CSS variables in `app/globals.css`; add new colours there
  from the tokens, never as one-off hex values in components.
- `logo/` and `symbols/` hold the approved artwork. Never redraw the logo or retype
  the wordmark in a font. `components/logo-paths.ts` is copied from
  `logo/medfave-lockup-primary.svg`; when the artwork changes, copy it again.
- `guidelines/Medfave-Brand-Guidelines.pdf` has the usage rules — for example,
  fuchsia is never used for body text, and white on fuchsia is for large type only.
- Where this app deliberately differs from the tokens (the dark palette, clinical
  status colours), `app/globals.css` says why. Keep those differences unless the
  brand repo changes.
