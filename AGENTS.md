<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
