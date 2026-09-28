# Mobile API (v1)

The JSON API the medfave mobile app talks to, under `/api/v1`. It applies the
same rules as the web pages; where a page would redirect, the API answers with
a status code instead.

## Authentication

Sign in (or activate) to get a token, keep it on the device, and send it on
every request:

```
Authorization: Bearer <token>
```

- A token lasts **30 days**. Changing the account's password ends every token
  issued before the change.
- Roles are read from the database on every request, never from the token, so
  a revoked role stops working at once.
- App tokens work only as bearer tokens, and web session cookies work only as
  cookies.
- Signing out is the app deleting its token.

## Cross-origin

`/api/v1` answers any origin (CORS `*`). That's safe because it is
authenticated by the bearer token, never by cookies. It lets the app's web
build call it; the native apps don't use CORS. Web pages don't send these
headers.

## Errors

Every error is JSON:

```json
{ "error": "Check the details of your request.", "fieldErrors": { "preferredDate": ["Choose a date"] } }
```

`fieldErrors` is present when specific inputs were wrong, keyed by field name.

| Status | Meaning |
| --- | --- |
| 400 | The body was not JSON |
| 401 | No token, an expired or invalid token, or wrong email or password |
| 403 | Signed in, but this endpoint is for another kind of account |
| 404 | Not found, or not yours — deliberately the same answer |
| 422 | The input broke a rule; see `fieldErrors` |

## Endpoints

Times are ISO 8601 instants in UTC (`2026-09-29T03:20:00.000Z`). Calendar dates
are `YYYY-MM-DD` and times of day `HH:MM`, both in clinic time (Asia/Manila).

### Sign-in

| | |
| --- | --- |
| `POST /auth/login` | `{ email, password }` → `{ token, expiresAt, viewer }` |
| `POST /auth/activate` | `{ code, fullName, email, password, confirmPassword }` → `201 { token, expiresAt, viewer }`. Turns the activation code the clinic gave a patient into their login. |
| `GET /me` | `{ viewer }` |

`viewer` is `{ id, email, fullName, role, clinic, patientId, doctorId }`, where
`role` is `"patient"`, `"doctor"`, `"staff"` or `"none"`. The app opens the
patient or doctor side from `role`.

### Patient

Everything is scoped to the signed-in patient's own chart. A patient never
sees the rest of their household. Other accounts get `403`.

| | |
| --- | --- |
| `GET /patient/appointments` | `{ upcoming[], past[] }`, each `{ id, scheduledAt, durationMinutes, service, serviceLabel, reason, status, statusLabel, visitType, doctor }` |
| `GET /patient/requests` | `{ requests[] }`, each `{ id, preferredDate, preferredTime, service, serviceLabel, reason, status, decisionNote, createdAt }` |
| `POST /patient/requests` | `{ service, preferredDate, preferredTime?, reason }` → `201 { id, status: "PENDING" }` |
| `DELETE /patient/requests/:id` | Withdraws a request that is still pending → `{ id, status: "WITHDRAWN" }` |
| `GET /patient/documents` | `{ documents[] }`, each `{ id, type, typeLabel, purpose, sharedAt }` |
| `GET /patient/documents/:id` | `{ document }`, with `fields[]` of `{ name, label, value }` in the clinic's order |
| `GET /patient/clinic` | `{ clinic, takingRequests, services[], schedule }` — what the request form needs: services, the week's hours, closures ahead, and `earliestDay` / `latestDay` |

A request is **not** a booking. It holds no slot, and the doctor or front desk
accepts or declines it. The app should say so. The server checks each request
against the clinic's hours, closures and booking window; `/patient/clinic` lets
the app warn before sending.

### Doctor

Not built yet. Planned: today's queue, arrivals, patient lookup, booking a
walk-in, and accepting or declining requests.
