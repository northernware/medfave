# "Is this you?" before an activation code links a chart

Opened: 2026-10-01 21:20 PHT

## What
- Activation and "Add a clinic" are now two steps. Entering the code shows whose record it opens (name, birthday, clinic, the clinic's email masked) and links only after **This is me**.
- If the clinic's email for that chart isn't the signed-in login's, a warning shows. It is a warning, not a refusal: chart emails go stale, get mistyped and get shared.
- Linking sends back the `confirmedPatientId` that was shown. If the code now opens a different chart, it's refused and the person has to enter it again.
- `lib/sign-in.ts`: adds `previewActivation`. `linkPatientActivation` and `activatePatient` check the confirmed chart.
- API: new `POST /api/v1/activation/preview`. `POST /patient/clinics` and `POST /auth/activate` accept `confirmedPatientId`.

## Why
JnMark Agustin's code was redeemed while signed in as patient@medfave.com (Ramon), which silently joined JnMark's chart at Northern club to Ramon's login. A code links whoever redeems it, so the person should see whose record it is first.

## Tested
- `tsc` and `eslint` are clean.
- The web flows have not been clicked through yet.

## Not done
- Mobile app: it doesn't call the preview yet. `confirmedPatientId` stays optional in the API until it does.
- Dependents ("someone I care for"): a parent linking a child's chart without becoming that child. This is planned as its own change.
- JnMark's chart (a344c7b5…) is still linked to Ramon's login. It needs unlinking on the dev DB.

## Heads-up
The one-chart-per-clinic rule was already enforced in `linkPatientActivation`.
