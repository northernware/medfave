# Change notes

One note per pull request, newest last by filename: `YYYY-MM-DD-<short-slug>.md`.
Every developer and every agent (Claude, ChatGPT or Codex, or any other) writes
one before pushing, in the same PR. **Read the newest few before starting work.**

Each note has these sections:

- **What:** what changed, in a few bullets.
- **Why:** the reason, or the request it answers.
- **Tested:** what was checked and how, and plainly what wasn't.
- **Not done / next:** loose ends, follow-ups, open questions.
- **Heads-up:** new env vars, migrations, renamed routes, new conventions or
  dependencies. Leave it out when there's nothing.

Keep notes short; the diff has the detail. The full rule is in `AGENTS.md`.
