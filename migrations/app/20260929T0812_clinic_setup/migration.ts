#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0b1cd57301ca424643f8d57385d6122ad907b1c2f7f954dbd5210364ee05a4f9/contract';
import endContract from '../../snapshots/0b1cd57301ca424643f8d57385d6122ad907b1c2f7f954dbd5210364ee05a4f9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/46d6038ae2dabe39a7ee5a0a24e88afe6554c9f1b850d37cf36ffd638796ae39/contract';
import startContract from '../../snapshots/46d6038ae2dabe39a7ee5a0a24e88afe6554c9f1b850d37cf36ffd638796ae39/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

/**
 * Doctors create their clinic (plans/registration.md, phase 2).
 *
 * Adds licence verification to doctors and the platform-admin flag to
 * accounts. Every doctor that already exists is stamped VERIFIED: they were
 * set up by us before self sign-up, and locking them out of their own
 * patients would be the wrong way to introduce a check.
 *
 * Query plans only: the client is built against the end contract and never
 * connects. The runner executes them inside the migration's own transaction.
 */
const db = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'VerificationStatus',
        members: ['PENDING', 'VERIFIED', 'DECLINED'],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('platformAdmin', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('declineReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('verificationStatus', '"VerificationStatus"', {
          notNull: true,
          default: lit('PENDING'),
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'VerificationStatus' } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('verificationSubmittedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('verifiedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('verifiedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(db.contract, 'verify-existing-doctors', {
        check: () => db.sql.public.Doctor.select('id').where((f, fns) => fns.eq(f.verifiedAt, null)).limit(1),
        run: () =>
          db.raw.sql`UPDATE "public"."Doctor" SET "verificationStatus" = 'VERIFIED', "verifiedAt" = "createdAt" WHERE "verifiedAt" IS NULL`.affectedCount(),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Doctor',
        index: 'Doctor_verifiedById_idx_dfd74b37',
        columns: ['verifiedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Doctor',
        foreignKey: {
          name: 'Doctor_verifiedById_fkey',
          columns: ['verifiedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
