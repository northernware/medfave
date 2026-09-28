# Mobile API: app tokens and patient endpoints

PR #18 (merged). Written afterwards.

## What
- A JSON API under `/api/v1` for the mobile app. The contract is in `docs/api.md`.
- App tokens: `POST /auth/login` and `POST /auth/activate` return a 30-day bearer token with an audience. App tokens work only as bearer tokens and web cookies only as cookies.
- `getViewer`'s lookup is now `viewerForSession`, shared by the cookie path and the API. The API gates in `lib/api.ts` answer 401 or 403 in JSON.
- Sign-in, activation and request create/withdraw moved into `lib/sign-in.ts` and `lib/requests.ts`, shared by the server actions and the API.
- Patient endpoints: appointments, requests (list, create, withdraw), shared documents, and clinic info for the request form.

## Why
The first step of the build order in `PRODUCT.md`. The mobile app still runs on placeholder data.

## Tested
Typecheck and lint. Against the dev database, read-only: login (right and wrong password), `/me`, every patient GET, and refusals for no token, a wrong-role token, a tampered token, an unknown id, and an app token used as a cookie. The web sign-in form was checked in a browser.

**Not tested:** the calls that write (`POST /auth/activate`, `POST /patient/requests`, `DELETE /patient/requests/:id`). They run the same shared code as the portal forms.

## Not done / next
- Doctor endpoints: today's queue, arrivals, patient lookup, walk-in booking, accepting or declining requests.
- Wire medfave-mobile's patient side to this API.
- There is no rate limiting on `/auth/login`. The web form has none either.

## Heads-up
- Keep `docs/api.md` in step with every API change.
- Put business rules in `lib/`, never in a route handler.
