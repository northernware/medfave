import { apiError, apiViewer, readJson } from "@/lib/api";
import { findDoctor, readNewPatient } from "@/lib/discovery";
import { familyMember } from "@/lib/family";
import { hit, TOO_MANY } from "@/lib/rate-limit";
import { createAppointmentRequest } from "@/lib/requests";
import { orm } from "@/src/prisma/db";

/**
 * Ask a doctor for a visit — at any clinic, including one where the caller
 * has no record yet. Body: `{ doctorId, service, preferredDate, preferredTime?,
 * reason, details? }`. With a record at that clinic `details` is ignored;
 * without one it's required (`{ firstName, middleName?, lastName,
 * dateOfBirth, sex, contactNumber, address, email? }`) and the request is a
 * **new patient**'s: the clinic links or creates their record on accepting.
 * A request holds no slot; the clinic confirms a time.
 *
 * **For somebody else:** add `familyMemberId` (one of `GET /family`). Their
 * name, birthday and sex come from the family list; `details` still gives the
 * mobile and address to reach them by (the requester's, usually). If this login
 * already looks after their chart at the clinic it's used; otherwise they're a
 * new patient, and accepting makes the requester their caregiver — never the
 * chart's own login.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  if (!(await hit(`request:account:${viewer.accountId}`, { limit: 20, windowSeconds: 24 * 60 * 60 }))) {
    return apiError(429, TOO_MANY);
  }
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the request as JSON.");

  const doctor = await findDoctor(String(body.doctorId ?? ""));
  if (!doctor) return apiError(404, "No doctor with that id.");

  // Who the visit is for: this login, or somebody on its family list.
  const member = body.familyMemberId ? await familyMember(viewer.accountId, String(body.familyMemberId)) : null;
  if (body.familyMemberId && !member) return apiError(404, "That person isn't on your family list.");

  // Their chart here, if there is one this login may act on. For a family
  // member: one it already looks after with the same name and birthday.
  const chart = member
    ? (viewer.charts.find((c) => c.clinicId === doctor.clinic.id && !c.self && sameMember(c.name, member)) ?? null)
    : await orm.Patient
        .select("id")
        .where((p) => p.clinicId.eq(doctor.clinic.id))
        .where((p) => p.accountId.eq(viewer.accountId))
        .first();
  let details;
  if (!chart) {
    if (!body.details || typeof body.details !== "object") {
      return apiError(422, "You're new to this clinic: tell them who you are — name, birthday, sex, mobile and address.", {
        details: ["Required for a new patient"],
      });
    }
    const given = body.details as Record<string, unknown>;
    const read = readNewPatient(
      member
        ? {
            ...given,
            firstName: member.firstName,
            middleName: member.middleName ?? undefined,
            lastName: member.lastName,
            dateOfBirth: member.dateOfBirth,
            sex: member.sex,
          }
        : given,
    );
    if (!read.ok) return apiError(422, read.message ?? "Check your details.", read.fieldErrors);
    details = read.details;
  }

  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const result = await createAppointmentRequest(
    { clinicId: doctor.clinic.id, accountId: viewer.accountId, patientId: chart?.id ?? null },
    {
      service: text(body.service),
      preferredDate: text(body.preferredDate),
      preferredTime: text(body.preferredTime),
      reason: text(body.reason),
      doctorId: doctor.id,
    },
    details,
    member ? { relationship: member.relationship, familyMemberId: member.id } : undefined,
  );
  if (!result.ok) return apiError(422, result.message ?? "Check your request.", result.fieldErrors);
  return Response.json({ id: result.id, status: "PENDING", newPatient: !chart }, { status: 201 });
}

/**
 * Every request this account has sent, at any clinic — including ones where
 * they're not a patient yet → `{ requests: [{ id, status, preferredDate,
 * preferredTime, service, reason, decisionNote, doctor, clinic }] }`, newest first.
 */
export async function GET(request: Request) {
  const viewer = await apiViewer(request);
  if (viewer instanceof Response) return viewer;
  const rows = await orm.AppointmentRequest
    .select("id", "status", "preferredDate", "preferredTime", "service", "reason", "decisionNote", "createdAt")
    .include("doctor", (d) => d.select("fullName", "specialty"))
    .include("clinic", (c) => c.select("name"))
    .where((r) => r.requestedById.eq(viewer.accountId))
    .orderBy((r) => r.createdAt.desc())
    .limit(30)
    .all();
  return Response.json({
    requests: rows.map((r) => ({
      id: r.id,
      status: r.status,
      preferredDate: r.preferredDate,
      preferredTime: r.preferredTime,
      service: r.service,
      reason: r.reason,
      decisionNote: r.decisionNote,
      doctor: { fullName: r.doctor.fullName, specialty: r.doctor.specialty },
      clinic: { name: r.clinic.name },
    })),
  });
}

/** A looked-after chart's name ("First Last") against a family list entry. */
function sameMember(chartName: string, m: { firstName: string; lastName: string }) {
  return chartName.trim().toLowerCase() === `${m.firstName} ${m.lastName}`.trim().toLowerCase();
}
