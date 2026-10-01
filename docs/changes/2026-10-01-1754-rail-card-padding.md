# Schedule visit cards: padding, and the service line

Opened: 2026-10-01 17:54 PHT

**What:** visit cards get more inner padding (16px sides, 12px top/bottom, 6px between lines; min height 104px). The line under the name shows the service ("Follow-up Checkup") instead of the free-text reason, which is now the line's tooltip.

**Why:** the user found the card cramped, and expected "Follow-up Checkup" rather than the typed reason ("inamo mark", test text).

**Tested:** `tsc`, eslint; Calendar screenshot.
