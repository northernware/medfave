# Visit history without gaps; My family as one list on the web

Opened: 2026-10-02 13:02 PHT

## What
- History now also logs a visit's time being changed in Edit ("Time changed · Was …"), a patient cancelling in the app, the old visit cancelled when a move is accepted, and finishing a note (Completed, once, not again on each amendment).
- The portal's My family is one list: the people you added and those a clinic linked, matched by name, each marked "Northern Family Clinic · you can see their records" or "not linked to a clinic yet".

## Why
Gaps the user noticed in the visit log. The two family lists confused them, as in medfave-mobile#52.

## Tested
`tsc` and `eslint` are clean. Not run.

## Not done / next
- A real link between a family-list person and a clinic chart, instead of matching by name, kept in sync both ways. That's next.
