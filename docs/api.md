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
| `GET /auth/providers` | → `{ google }`. Whether "Continue with Google" is set up on this server; show the button only when `true` |
| `POST /auth/google/exchange` | `{ code, verifier }` → `{ token, expiresAt, viewer }`. The end of a Google sign-in; see below |
| `GET /me` | `{ viewer }` |
| `POST /practice` | `{ licenseName, licenseNumber, specialty?, clinicName, address, contactNumber }` → `201 { viewer }`. A signed-up doctor creates their clinic; it opens once a Medfave admin verifies the license (`viewer.verification`). Email must be confirmed first (422 otherwise). `licenseNumber` is 7 digits |
| `POST /practice/resubmit` | `{ licenseName, licenseNumber, specialty? }` → `{ viewer }`. A declined doctor sends corrected details again |

**Continue with Google.** The server does the OAuth; the app opens it in a
browser session (`WebBrowser.openAuthSessionAsync`) and never sees Google's
tokens.

1. Make a random `verifier` (43+ characters, base64url) and its
   `challenge = base64url(sha256(verifier))`.
2. Open `GET /auth/google?app=<return link>&challenge=<challenge>` (a page,
   not under `/api/v1`), adding `&as=doctor` when the person chose doctor. The
   return link must use the `medfave://` scheme; in development `exp://` and
   `http://localhost` are allowed too.
3. The person picks a Google account. Somebody new also chooses patient or
   doctor and agrees to the privacy notice on a Medfave page in that same
   browser session.
4. The browser comes back to the return link with `?code=…` (good for two
   minutes), or `?error=cancelled | unverified | failed | unavailable`.
5. `POST /auth/google/exchange` with the `code` and the `verifier`.

A Google account whose verified email matches an existing account signs in to
that account; there is never a second account for one email.

`viewer` is `{ id, email, fullName, role, clinic, charts, emailVerified, signupRole, patientId, doctorId }`:

- `role` is `"doctor"`, `"patient"`, `"staff"` or `"none"`. A doctor or staff
  member of a clinic that isn't verified yet is `"none"`. Work comes first:
  a doctor who is also somebody's patient elsewhere is `"doctor"`. The app
  opens the patient or doctor side from `role`.
- `charts` is `[{ patientId, clinic: { id, name } }]`, one per clinic this
  login is linked to. One login can be a patient at several clinics.
- `emailVerified` is whether they've followed the emailed link.
- `signupRole` is `"PATIENT"`, `"DOCTOR"` or `null` (accounts from before open
  sign-up): what they said they were. It picks the welcome for an account with
  `role: "none"`, and grants nothing.
- `patientId` is the first chart's id, kept for older app builds. Use `charts`.
- `verification` is a doctor's license check, `{ status: "PENDING" | "VERIFIED"
  | "DECLINED", declineReason }`, or `null` for anyone with no clinician
  profile. Until it is `VERIFIED` the doctor's `role` is `"none"` and their
  clinic is closed: doctor endpoints answer 403. The practice is set up, and
  a decline fixed, on the web (`/welcome`, then `/manage`).

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
| `POST /patient/requests` | `{ service, preferredDate, preferredTime?, reason, doctorId? }` → `201 { id, status: "PENDING" }`. Patients ask for a **doctor**: `doctorId` is one of `/patient/clinic`'s `doctors`. Left out: the doctor they saw last, or the only one; with several and no history, `422` asks to choose. Checked against that doctor's hours |
| `DELETE /patient/requests/:id` | Withdraws a request that is still pending → `{ id, status: "WITHDRAWN" }` |
| `GET /patient/documents` | `{ documents[] }`, each `{ id, type, typeLabel, purpose, sharedAt }` |
| `GET /patient/documents/:id` | `{ document }`, with `fields[]` of `{ name, label, value }` in the clinic's order |
| `GET /patient/clinic?doctor=` | `{ clinic, doctors[], doctorId, takingRequests, services[], schedule }` — what the request form needs. `doctors` are the clinic's bookable doctors `{ id, fullName, specialty }`; `doctorId` is whose hours and services follow: `?doctor=` if given, else the patient's last doctor, else the only one (`null`: ask them to choose). `schedule` has the week's hours, closures ahead, and `earliestDay` / `latestDay` |

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
| `GET /doctor/clinic` | Same shape as `/patient/clinic`, for the signed-in doctor's own hours, plus `breaks`, `slotStepMinutes` and `today` |
| `GET /doctor/hours` | `{ mine, mineConfigured, clinic }`: this doctor's week (the standard week inside the clinic's when never set — `mineConfigured: false`) and the clinic's, each `[{ weekday, openMinute, closeMinute }]` (0 = Sunday). An empty `clinic` sets no limit |
| `PUT /doctor/hours` | `{ which: "mine" \| "clinic", days: [{ weekday, from: "HH:MM", to: "HH:MM" }] }` (open days only) → the same as GET. A doctor's days must sit inside the clinic's; `422` with `fieldErrors["day-<weekday>"]` otherwise |
| `GET /doctor/schedule` | `{ breaks: [{ id, weekday \| null, startMinute, endMinute, label }], closures: [{ id, startsOn, endsOn, startMinute?, endMinute?, reason }] (not yet over), lengths: [{ service, label, defaultMinutes, minutes \| null }] }` for this doctor. `weekday: null` is every day |
| `POST /doctor/schedule` | One of `{ kind: "break", weekday \| null, from, to, label }`, `{ kind: "closure", startsOn, endsOn?, from?, to?, reason }` (no times = whole days) or `{ kind: "lengths", minutes: { [service]: number \| null } }` (null = built-in) → the same as GET; `422` with `fieldErrors` when something needs fixing |
| `DELETE /doctor/schedule?break=<id>` or `?closure=<id>` | → the same as GET |
| `GET /doctor/clinic-settings` | `{ clinic: { name, address, contactNumber, sharedCharts }, staff: [{ fullName, email, role }], invites: [{ email, role }] }` |
| `PUT /doctor/clinic-settings` | `{ name, address, contactNumber }` and/or `{ sharedCharts }` → the same as GET. Details follow the web's rules (`422` with `fieldErrors`) |
| `POST /doctor/staff` | `{ email, role: "SECRETARY" \| "DOCTOR" \| "ADMIN" }` → `201 { code, mail }`. Invites somebody, as Manage → Staff; `mail` is `sent`, `off` or `failed` and the code is shown either way |

### Finding a doctor

Any signed-in account. Only verified doctors appear.

| | |
| --- | --- |
| `GET /discover?q=&specialty=` | `{ doctors: [{ id, fullName, specialty, clinic: { id, name, address, slug } }], specialties[] }` — doctors at clinics that list themselves |
| `GET /discover/doctors/:id` | `{ doctor, booking, knownPatient }` — `booking` is `/patient/clinic`'s shape for this doctor (services, hours, window); `knownPatient` says the caller already has a record there |
| `GET /discover/clinics/:slug` | `{ clinic, doctors[] }` — a clinic by its link, listed or not |
| `POST /discover/requests` | `{ doctorId, service, preferredDate, preferredTime?, reason, details? }` → `201 { id, status, newPatient }`. Without a record at that clinic, `details` (`{ firstName, middleName?, lastName, dateOfBirth, sex, contactNumber, address, email? }`) is required and the request is a new patient's |
| `GET /discover/requests` | `{ requests[] }` — every request this account sent, at any clinic |

`GET /doctor/requests` marks a new patient's request with `newPatient: { dateOfBirth, contactNumber, email, lookalikes[] }` (`patient.id` is null). Accepting one needs `record`: `"new"` to create their record, or a look-alike's patient id to link it. `/doctor/clinic-settings` adds `listed`, `slug` and `link`. The clinic's QR code is a PNG at `/c/<slug>/qr` (public, not under `/api/v1`), and a printable poster at `/c/<slug>/poster`.
| `GET /doctor/patients?q=&who=` | `{ patients[] }`, each `{ id, fullName, patientNumber, household, mine }`. The clinic's patients (for booking); `who=mine` keeps those this doctor cares for. Name or number match; at most 50; archived charts left out |
| `GET /doctor/patients/:id` | `{ patient, caresFor, chart, visits, upcoming[], past[] }`. Details for any clinic patient. `chart` (`allergies`, `alerts`, `conditions`, `medications`, and the three `…Status` values) and `visits` (`{ id, status, visitDate, chiefComplaint, assessment, mine, author }`) only when `caresFor`, else `null`; in a clinic that shares charts every doctor cares for every patient. `upcoming` / `past` are this doctor's own appointments. Opening a chart is logged |
| `GET /doctor/records?appointmentId=` | `{ record }`: the note this doctor already started for that appointment, or `null` |
| `GET /doctor/records/:id` | `{ record }`: a note to read or continue — this doctor's, or any at a clinic that shares charts (`mine` says whether it can be changed). Logged |
| `POST /doctor/records` | `{ recordId?, intent: "draft" \| "finish", patientId, appointmentId?, visitDate: "YYYY-MM-DDTHH:MM", chiefComplaint, historyOfPresentIllness?, physicalExamination?, temperatureC?, heartRate?, respiratoryRate?, systolic?, diastolic?, weightKg?, heightCm?, oxygenSaturation?, assessment?, treatmentPlan?, followUpDate?, notes?, amendmentReason?, prescriptions: [{ drugName, dosage, frequency, duration?, instructions? }] }` → `{ record }`. The web's rules exactly: drafts autosave to one row (send back `record.id`); `finish` validates and signs; changing a signed note needs `amendmentReason` and adds a version; a teleconsultation can't record examination or vitals; an appointment must be in consultation or completed. `422` with `fieldErrors` otherwise |
| `POST /doctor/appointments` | `{ patientId, service, reason, date, time, walkIn? }` → `201 { id }`. A walk-in skips the booking lead time and joins the queue as checked in. `409` when the time was just taken |
| `POST /doctor/appointments/:id/status` | `{ status }` → `{ id, status }`. `409` for a move `nextStatuses` doesn't allow, or when restoring a visit whose slot has since gone |
| `GET /doctor/requests` | `{ requests[] }` for **this doctor** waiting for an answer, oldest first, each with `patient: { id, fullName }`. A doctor can only accept or decline their own (others are `404`); the desk handles any, on the web |
| `POST /doctor/requests/:id/accept` | `{ time? }` → `{ id, status: "ACCEPTED", appointmentId }`. `time` is required when the patient asked for any time. `409` when the time is no longer free |
| `POST /doctor/requests/:id/decline` | `{ note? }` → `{ id, status: "DECLINED" }`. The patient reads the note |

Booking, status changes and accepting requests all run through
`lib/booking.ts`, under the same lock and overlap check as the web forms.
