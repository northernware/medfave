# 6-digit activation code

Opened: 2026-10-01 04:07 PHT

**What:**
- Issuing an activation code now also makes a **6-digit code** that works for 30 minutes. The desk shows it large, beside the QR.
- The long code is unchanged and still carried by the QR, the shared message and the email (14 days).
- Redeeming (web register, add a clinic, app activate/add clinic) accepts either. A 6-digit input is matched by `pinHash` and must be within `pinExpiresAt`.
- PIN hashed with HMAC keyed by `SESSION_SECRET` (`lib/tokens.ts`: `issuePin`, `hashPin`, `asPin`); no two live activations share a PIN.
- Code field placeholders say "6-digit code".

**Why:** typing a 16-character code is too much; the user asked for an OTP-style code plus a fresh QR to scan.

**Tested:** `tsc`, eslint; migration planned and applied to dev. Not yet redeemed end to end.

**Heads-up:** migration `20260930T2005_activation_pin` (additive: `PatientActivation.pinHash`, `pinExpiresAt`, index). Existing codes have no PIN and still work by their long code.
