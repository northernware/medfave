import { revalidatePath } from "next/cache";
import { apiDoctor, apiError, readJson } from "@/lib/api";
import { hasPassed, instantToDb } from "@/lib/datetime";
import { clinicDetailsSchema, toFieldErrors } from "@/lib/validation";
import { ensureSlug } from "@/lib/clinic-link";
import { appUrl } from "@/lib/email";
import { orm } from "@/src/prisma/db";

/**
 * The clinic's settings, for its doctors in the app: details (as printed on
 * letterheads), whether charts are shared, and who works there. The same
 * rules as Manage on the web.
 */
export async function GET(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const [clinic, members, invites] = await Promise.all([
    orm.Clinic.select("name", "address", "contactNumber", "sharedCharts", "listed").where((c) => c.id.eq(doctor.clinicId)).first(),
    orm.ClinicMember
      .select("role")
      .include("account", (a) => a.select("fullName", "email"))
      .where((m) => m.clinicId.eq(doctor.clinicId))
      .all(),
    orm.StaffInvite
      .select("email", "role", "expiresAt")
      .where((i) => i.clinicId.eq(doctor.clinicId))
      .where((i) => i.acceptedAt.isNull())
      .where((i) => i.revokedAt.isNull())
      .all(),
  ]);
  if (!clinic) return apiError(404, "No clinic.");
  return Response.json({
    clinic: { ...clinic, link: appUrl(`/c/${await ensureSlug(doctor.clinicId)}`) },
    staff: members.map((m) => ({ fullName: m.account.fullName, email: m.account.email, role: m.role })),
    invites: invites.filter((i) => !hasPassed(i.expiresAt)).map((i) => ({ email: i.email, role: i.role })),
  });
}

/** Body: any of `{ name, address, contactNumber }` (all three together), `{ sharedCharts: boolean }`, `{ listed: boolean }`. */
export async function PUT(request: Request) {
  const doctor = await apiDoctor(request);
  if (doctor instanceof Response) return doctor;
  const body = await readJson(request);
  if (!body) return apiError(400, "Send the settings as JSON.");

  const update: Record<string, unknown> = {};
  if ("name" in body) {
    const parsed = clinicDetailsSchema.safeParse({ name: body.name ?? "", address: body.address ?? "", contactNumber: body.contactNumber ?? "" });
    if (!parsed.success) {
      const e = toFieldErrors(parsed.error);
      return apiError(422, e.message ?? "Check the details.", e.fieldErrors);
    }
    Object.assign(update, parsed.data);
  }
  if (typeof body.sharedCharts === "boolean") update.sharedCharts = body.sharedCharts;
  if (typeof body.listed === "boolean") update.listed = body.listed;
  if (Object.keys(update).length === 0) return apiError(400, "Nothing to change.");

  await orm.Clinic.where((c) => c.id.eq(doctor.clinicId)).update({ ...update, updatedAt: instantToDb(new Date()) });
  // The name sits in every web page's header.
  revalidatePath("/", "layout");
  return GET(request);
}
