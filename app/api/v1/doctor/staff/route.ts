import { apiDoctor, apiError, readJson } from "@/lib/api";
import { createStaffInvite } from "@/lib/staff";
import { orm } from "@/src/prisma/db";

/**
 * Invites somebody to the clinic from the app, as Manage → Staff does.
 * Body: `{ email, role: "SECRETARY" | "DOCTOR" | "ADMIN" }` → `201 { code, mail }`.
 * The code is shown to the inviter whatever happened to the email.
 */
export async function POST(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send { email, role }.");
  const clinic = await orm.Clinic.select("name").where((c) => c.id.eq(doctor.clinicId)).first();
  const result = await createStaffInvite(
    { clinicId: doctor.clinicId, clinicName: clinic?.name ?? "", accountId: doctor.accountId, fullName: doctor.fullName, clinicOpen: true },
    { email: String(body.email ?? "").trim().toLowerCase(), role: body.role },
  );
  if (!result.ok) return apiError(422, result.message ?? "Check the invitation.", result.fieldErrors);
  return Response.json({ code: result.code, mail: result.mail }, { status: 201 });
}
