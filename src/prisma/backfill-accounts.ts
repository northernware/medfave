import "dotenv/config";
import { db, orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";

/**
 * Gives every clinician a clinic, a membership, and clinic ownership of
 * everything they hold.
 *
 * Written to be run twice without harm: every step asks whether it has already
 * been done. That matters more than elegance here — a half-finished backfill on
 * a chart is not something anybody wants to reason about, and being able to
 * simply run it again is the cheapest way to make that impossible. The seed
 * calls it too, so there is one rule about ownership rather than two that could
 * drift apart.
 *
 * Nothing is destroyed. `doctorId` stays exactly where it was on every row, so
 * every existing link, every note's authorship and every version's author
 * survive untouched; `clinicId` is added beside it as the boundary queries are
 * scoped by.
 *
 * One step is missing from this file on purpose. When accounts were introduced
 * it also copied each doctor's email and password hash out of the Doctor row
 * into a new Account. Those columns were then dropped by
 * `doctor_credentials_move_to_account`, so that step cannot run again and no
 * longer compiles; it is preserved in this file's history. A clinician who
 * somehow has no account is now reported rather than invented — guessing at
 * credentials is not something a backfill should do.
 */
export async function backfillAccountsAndClinics() {
  const now = instantToDb(new Date());
  const summary = {
    clinicsCreated: 0,
    membershipsCreated: 0,
    doctorsLinked: 0,
    doctorsWithoutAccounts: 0,
    households: 0,
    patients: 0,
    appointments: 0,
    records: 0,
    documents: 0,
  };

  const doctors = await orm.Doctor
    .select("id", "fullName", "clinicName", "clinicId", "accountId")
    .all();

  for (const doctor of doctors) {
    if (!doctor.accountId) {
      // Nothing here can conjure a login. Say so, and leave the row alone.
      console.warn(
        `  ! ${doctor.fullName} (${doctor.id}) has no account — skipped. Create one and re-run.`,
      );
      summary.doctorsWithoutAccounts++;
      continue;
    }
    const accountId = doctor.accountId;

    await db.transaction(async (tx) => {
      const t = tx.orm.public;

      // --- the clinic ------------------------------------------------------
      let clinicId = doctor.clinicId;
      if (!clinicId) {
        const clinic = await t.Clinic.select("id").create({
          id: newId(),
          name: doctor.clinicName ?? `${doctor.fullName}'s practice`,
          createdAt: now,
          updatedAt: now,
        });
        clinicId = clinic.id;
        summary.clinicsCreated++;
      }
      const id = clinicId;

      // --- membership is the permission ------------------------------------
      const member = await t.ClinicMember
        .select("id")
        .where((m) => m.clinicId.eq(id))
        .where((m) => m.accountId.eq(accountId))
        .first();
      if (!member) {
        await t.ClinicMember.create({
          id: newId(),
          clinicId: id,
          accountId,
          role: "DOCTOR",
          createdAt: now,
          updatedAt: now,
        });
        summary.membershipsCreated++;
      }

      if (!doctor.clinicId) {
        await t.Doctor.where((d) => d.id.eq(doctor.id)).update({
          clinicId: id,
          updatedAt: now,
        });
        summary.doctorsLinked++;
      }

      // --- everything the clinic owns --------------------------------------
      // Through the raw lane: these match many rows on a non-unique column,
      // which the ORM's update is not shaped for. Written out one table at a
      // time rather than looping over a name, so no identifier is ever
      // interpolated into SQL.
      const run = async (plan: unknown) => {
        const result = (await tx.execute(plan as never)) as { affectedRows: number };
        return result.affectedRows;
      };
      const mine = doctor.id;

      summary.households += await run(
        db.raw.sql`UPDATE "Household" SET "clinicId" = ${id} WHERE "doctorId" = ${mine} AND "clinicId" IS NULL`
          .affectedCount()
          .build(),
      );
      // A patient's clinic comes through their household, which has just been
      // given one.
      summary.patients += await run(
        db.raw.sql`
          UPDATE "Patient" SET "clinicId" = ${id}
          WHERE "clinicId" IS NULL
            AND "householdId" IN (SELECT "id" FROM "Household" WHERE "doctorId" = ${mine})
        `
          .affectedCount()
          .build(),
      );
      summary.appointments += await run(
        db.raw.sql`UPDATE "Appointment" SET "clinicId" = ${id} WHERE "doctorId" = ${mine} AND "clinicId" IS NULL`
          .affectedCount()
          .build(),
      );
      summary.records += await run(
        db.raw.sql`UPDATE "MedicalRecord" SET "clinicId" = ${id} WHERE "doctorId" = ${mine} AND "clinicId" IS NULL`
          .affectedCount()
          .build(),
      );
      summary.documents += await run(
        db.raw.sql`UPDATE "DocumentRequest" SET "clinicId" = ${id} WHERE "doctorId" = ${mine} AND "clinicId" IS NULL`
          .affectedCount()
          .build(),
      );
    });
  }

  return summary;
}

// Run directly: `npm run db:backfill`. Guarded so the seed can import the
// function without also running it, and wrapped rather than awaited at the top
// level so the file transpiles under CommonJS as well as ESM.
const entry = process.argv[1] ?? "";
if (entry.includes("backfill-accounts")) {
  backfillAccountsAndClinics()
    .then((summary) => {
      console.log("Backfill complete.");
      for (const [key, value] of Object.entries(summary)) {
        console.log(`  ${key.padEnd(24)} ${value}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Backfill failed:", error);
      process.exit(1);
    });
}
