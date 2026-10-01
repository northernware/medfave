import "server-only";
import { db, orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";

/**
 * Somebody starting their own family: a new household with them at its head,
 * and whichever of their current household's members go with them (a spouse,
 * their children). One household per person, so this is a move, never a copy;
 * records belong to each chart and go with it. The new household notes where
 * they came from. Adults only. Shared by the web and the app's API.
 */
export async function startOwnHouseholdFor(
  staff: { clinicId: string },
  patientId: string,
  memberIds: string[],
): Promise<{ ok: true; householdId: string; name: string } | { ok: false; message: string }> {
  const going = memberIds.filter((id) => id && id !== patientId);

  const patient = await orm.Patient
    .select("id", "firstName", "lastName", "contactNumber", "householdId", "archivedAt", "dateOfBirth")
    .include("household", (h) => h.select("id", "name", "doctorId", "address"))
    .where((p) => p.id.eq(patientId))
    .where((p) => p.clinicId.eq(staff.clinicId))
    .first();
  if (!patient || patient.archivedAt) return { ok: false, message: "That patient can't be moved." };
  // Heading a household is for adults: a child stays in their family's.
  if (!isAdult(String(patient.dateOfBirth))) return { ok: false, message: "Only an adult can head a household." };

  // Household names are unique per doctor, and the family's own usually has
  // the same surname: "Dela Cruz" is taken, so "Dela Cruz (Lia)", then numbered.
  const taken = new Set(
    (await orm.Household.select("name").where((h) => h.doctorId.eq(patient.household.doctorId)).all()).map((h) =>
      h.name.toLowerCase(),
    ),
  );
  let name = patient.lastName;
  if (taken.has(name.toLowerCase())) name = `${patient.lastName} (${patient.firstName})`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${patient.lastName} (${patient.firstName}) ${n}`;

  // Only people from the same household may come along.
  const members = going.length
    ? await orm.Patient
        .select("id")
        .where((p) => p.householdId.eq(patient.householdId))
        .where((p) => p.clinicId.eq(staff.clinicId))
        .all()
    : [];
  const moving = [patientId, ...members.map((m) => m.id).filter((id) => going.includes(id))];

  const householdId = await db.transaction(async (tx) => {
    const t = tx.orm.public;
    const now = instantToDb(new Date());
    const today = new Date().toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "Asia/Manila" });
    const created = await t.Household.select("id").create({
      id: newId(),
      clinicId: staff.clinicId,
      doctorId: patient.household.doctorId,
      name,
      contactNumber: patient.contactNumber,
      notes: `Started from the ${patient.household.name} household (${today}).`,
      createdAt: now,
      updatedAt: now,
    } as Parameters<typeof t.Household.create>[0]);

    // Anybody moving stops being the old household's point of contact first:
    // the column is uniquely indexed, and they no longer live there.
    for (const id of moving) {
      const release = tx.sql.public.Household
        .update({ primaryContactId: null, updatedAt: now })
        .where((f, fns) => fns.eq(f.primaryContactId, id))
        .build();
      await tx.execute(release as never);
      await t.Patient.where((p) => p.id.eq(id)).update({
        householdId: created.id,
        ...(id === patientId ? { relationship: "HEAD" as const } : {}),
        updatedAt: now,
      });
    }
    await t.Household.where((h) => h.id.eq(created.id)).update({ primaryContactId: patientId, updatedAt: now });
    return created.id;
  });

  return { ok: true, householdId, name };
}

/** Whether somebody born on this YYYY-MM-DD date is 18 or over today. */
export function isAdult(dateOfBirth: string) {
  const [y, m, d] = dateOfBirth.slice(0, 10).split("-").map(Number);
  const now = new Date();
  const had = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  return now.getFullYear() - y - (had ? 0 : 1) >= 18;
}
