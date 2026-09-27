#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/605d56444bc1f1b7a8069b89844cf5f88165e9da18a1d0f97b7250e926acfa06/contract';
import endContract from '../../snapshots/605d56444bc1f1b7a8069b89844cf5f88165e9da18a1d0f97b7250e926acfa06/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/de655cbcb1bb114475992da00bf148113c9d29085aafc79d15ae38cffb15b364/contract';
import startContract from '../../snapshots/de655cbcb1bb114475992da00bf148113c9d29085aafc79d15ae38cffb15b364/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

/**
 * The clinic boundary becomes a database rule.
 *
 * Until now `clinicId` was nullable on every clinic-owned table, so the line
 * between one practice's records and another's existed only in application
 * code. After this, a row without a clinic cannot exist.
 *
 * Every row is expected to have its clinic already: `npm run db:backfill`
 * assigns them, and it is where the ownership rules live — a household's clinic
 * comes through its clinician, a patient's through their household. This
 * migration keeps no second copy of those rules. If it meets a row with no
 * clinic, it stops and rolls back and says to run the backfill, rather than
 * guessing which practice a patient belongs to.
 *
 * Query plans only: the client is built against the end contract and never
 * connects. The runner lowers these and executes them inside the migration's
 * own transaction.
 */
const db = postgres<End>({ contractJson: endContract });

// The transforms are handed the client's contract rather than the raw JSON: it
// is the same contract (the storage hashes match, which dataTransform checks),
// hydrated with the namespace qualifiers the SQL renderer needs to write
// "public"."Patient". The bare JSON has no such functions and cannot render.

const refuse = () =>
  db.raw.sql`DO $$ BEGIN RAISE EXCEPTION 'A clinic-owned row has no clinic. Run npm run db:backfill, then migrate again.'; END $$`.affectedCount();

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dataTransform(db.contract, 'handle-nulls-Appointment-clinicId', {
        check: () => db.sql.public.Appointment.select('id').where((f, fns) => fns.eq(f.clinicId, null)).limit(1),
        run: refuse,
      }),
      this.setNotNull({ schema: 'public', table: 'Appointment', column: 'clinicId' }),
      this.dataTransform(db.contract, 'handle-nulls-DocumentRequest-clinicId', {
        check: () => db.sql.public.DocumentRequest.select('id').where((f, fns) => fns.eq(f.clinicId, null)).limit(1),
        run: refuse,
      }),
      this.setNotNull({ schema: 'public', table: 'DocumentRequest', column: 'clinicId' }),
      this.dataTransform(db.contract, 'handle-nulls-Household-clinicId', {
        check: () => db.sql.public.Household.select('id').where((f, fns) => fns.eq(f.clinicId, null)).limit(1),
        run: refuse,
      }),
      this.setNotNull({ schema: 'public', table: 'Household', column: 'clinicId' }),
      this.dataTransform(db.contract, 'handle-nulls-MedicalRecord-clinicId', {
        check: () => db.sql.public.MedicalRecord.select('id').where((f, fns) => fns.eq(f.clinicId, null)).limit(1),
        run: refuse,
      }),
      this.setNotNull({ schema: 'public', table: 'MedicalRecord', column: 'clinicId' }),
      this.dataTransform(db.contract, 'handle-nulls-Patient-clinicId', {
        check: () => db.sql.public.Patient.select('id').where((f, fns) => fns.eq(f.clinicId, null)).limit(1),
        run: refuse,
      }),
      this.setNotNull({ schema: 'public', table: 'Patient', column: 'clinicId' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
