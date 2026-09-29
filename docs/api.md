# Mobile API (v1)

The JSON API the Medfave mobile app talks to, under `/api/v1`. It applies the
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
| 429 | Too many attempts (sign-in, sign-up, codes, emails); wait a few minutes |

## Endpoints

Times are ISO 8601 instants in UTC (`2026-09-29T03:20:00.000Z`). Calendar dates
are `YYYY-MM-DD` and times of day `HH:MM`, both in clinic time (Asia/Manila).

### Sign-in

| | |
| --- | --- |
| `POST /auth/signup` | `{ fullName, email, password, confirmPassword, role: "PATIENT" \| "DOCTOR", consent: true }` → `201 { token, expiresAt, viewer }`. Open sign-up: the account is signed in at once, unverified, and linked to nothing (`role: "none"`) |
| `POST /auth/resend-verification` | → `{ sent }`. A new verification link to the signed-in account's email |
| `POST /auth/login` | `{ email, password }` → `{ token, expiresAt, viewer }` |
| `POST /auth/activate` | `{ code, fullName, email, password, confirmPassword }` → `201 { token, expiresAt, viewer }`. Turns the activation code the clinic gave a patient into their login. |
| `GET /me` | `{ viewer }` |

`viewer` is `{ id, email, fullName, role, clinic, charts, emailVerified, signupRole, patientId, doctorId }`:

- `role` is `"doctor"`, `"patient"`, `"staff"` or `"none"`. Work comes first:
  a doctor who is also somebody's patient elsewhere is `"doctor"`. The app
  opens the patient or doctor side from `role`.
- `charts` is `[{ patientId, clinic: { id, name } }]`, one per clinic this
  login is linked to. One login can be a patient at several clinics.
- `emailVerified` is whether they've followed the emailed link.
- `signupRole` is `"PATIENT"`, `"DOCTOR"` or `null` (accounts from before open
  sign-up): what they said they were. It picks the welcome for an account with
  `role: "none"`, and grants nothing.
- `patientId` is the first chart's id, kept for older app builds. Use `charts`.

### Patient

Everything is scoped to the signed-in patient's own chart **at one clinic**.
A patient never sees the rest of their household, and a clinic's records are
never mixed with another's. Other accounts get `403`.

**Choosing the clinic:** pass `?clinic=<clinicId>` or an `X-Clinic-Id`
header on any patient endpoint. Left out, it uses the first of `viewer.charts`.
A clinic the login isn't linked to gets `404`.

| | |
| --- | --- |
| `GET /patient/clinics` | `{ clinics: [{ id, name, patientId }] }`: every clinic this login is linked to |
| `POST /patient/clinics` | `{ code }` → `201 { clinic: { id, name } }`. **Add a clinic:** redeems another clinic's activation code and links that clinic's chart to this login. Open to any signed-in account. `422` for an invalid code or a clinic already linked |
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

For accounts that are a clinic's DOCTOR, with a clinician profile in that
clinic, which is the same gate as the web's clinical pages. Other accounts get
`403`. Everything is scoped to the doctor's clinic.

An appointment is always this shape:

```
{ id, scheduledAt, durationMinutes, service, serviceLabel, reason, status, statusLabel,
  source, arrivedAt, consultationStartedAt, patient: { id, fullName },
  nextStatuses: [{ status, label }] }
```

`nextStatuses` lists the only moves the status endpoint will accept from where
the visit is now.

| | |
| --- | --- |
| `GET /doctor/day?date=YYYY-MM-DD` | `{ date, isToday, appointments[], queue[], pendingRequests }`. Today when `date` is left out. `queue` is who is here (checked in or with the doctor), in arrival order, and only for today. Marks overdue no-shows and sends tomorrow's reminders first, as the dashboard does. |
| `GET /doctor/week?from=&days=` | `{ days: [{ date, count }] }`: visits still expected per day (7 by default, 31 at most) |
| `GET /doctor/clinic` | Same shape as `/patient/clinic`, plus `breaks`, `slotStepMinutes` and `today` |
| `GET /doctor/patients?q=` | `{ patients[] }`, each `{ id, fullName, patientNumber, household }`. Name or number match; at most 50; archived charts left out |
| `GET /doctor/patients/:id` | `{ patient, upcoming[], past[] }`. Demographics, contact and household. Clinical notes stay on the web |
| `POST /doctor/appointments` | `{ patientId, service, reason, date, time, walkIn? }` → `201 { id }`. A walk-in skips the booking lead time and joins the queue as checked in. `409` when the time was just taken |
| `POST /doctor/appointments/:id/status` | `{ status }` → `{ id, status }`. `409` for a move `nextStatuses` doesn't allow, or when restoring a visit whose slot has since gone |
| `GET /doctor/requests` | `{ requests[] }` waiting for an answer, oldest first, each with `patient: { id, fullName }` |
| `POST /doctor/requests/:id/accept` | `{ time? }` → `{ id, status: "ACCEPTED", appointmentId }`. `time` is required when the patient asked for any time. `409` when the time is no longer free |
| `POST /doctor/requests/:id/decline` | `{ note? }` → `{ id, status: "DECLINED" }`. The patient reads the note |

Booking, status changes and accepting requests all run through
`lib/booking.ts`, under the same lock and overlap check as the web forms.
