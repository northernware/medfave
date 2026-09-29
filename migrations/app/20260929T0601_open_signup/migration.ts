#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/30a9ed7f15ffe62b3a0b880fcb853ad560092462b1374bab2c7eb48e2a3cb5be/contract';
import endContract from '../../snapshots/30a9ed7f15ffe62b3a0b880fcb853ad560092462b1374bab2c7eb48e2a3cb5be/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6dc60cf3b4ad2e98d8a1bd803da67c14a4595a7f5c8c8a4b548d92ee73d02ead/contract';
import startContract from '../../snapshots/6dc60cf3b4ad2e98d8a1bd803da67c14a4595a7f5c8c8a4b548d92ee73d02ead/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

/**
 * Open sign-up (plans/registration.md, phase 1).
 *
 * Adds email verification, the sign-up role, consent, and rate-limit buckets.
 * Every account that already exists is stamped as verified: staff were invited
 * to their address, and patients activated with a code from a desk that had
 * identified them. Without this, everybody already using medfave would
 * suddenly be told to verify.
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
        typeName: 'SignupRole',
        members: ['PATIENT', 'DOCTOR'],
      }),
      this.createTable({
        schema: 'public',
        table: 'EmailVerification',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('expiresAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'EmailVerification_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'RateLimitBucket',
        columns: [
          col('count', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('windowStart', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['key'], { name: 'RateLimitBucket_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('consentVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('consentedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('emailVerifiedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.dataTransform(db.contract, 'verify-existing-accounts', {
        check: () => db.sql.public.Account.select('id').where((f, fns) => fns.eq(f.emailVerifiedAt, null)).limit(1),
        run: () => db.raw.sql`UPDATE "public"."Account" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL`.affectedCount(),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('signupRole', '"SignupRole"', {
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'SignupRole' } },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerification',
        index: 'EmailVerification_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmailVerification',
        index: 'EmailVerification_tokenHash_key',
        columns: ['tokenHash'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmailVerification',
        foreignKey: {
          name: 'EmailVerification_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
