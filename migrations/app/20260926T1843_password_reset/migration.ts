#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2f520a5f5aacacc08411744686193f10454fe5ccddc6338b1b8fa82ddc601494/contract';
import endContract from '../../snapshots/2f520a5f5aacacc08411744686193f10454fe5ccddc6338b1b8fa82ddc601494/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b86db92d58069683062bf34dabdb270707fd6c634aa74011285cf01560cd52e9/contract';
import startContract from '../../snapshots/b86db92d58069683062bf34dabdb270707fd6c634aa74011285cf01560cd52e9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'PasswordReset',
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
        constraints: [primaryKey(['id'], { name: 'PasswordReset_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PasswordReset',
        index: 'PasswordReset_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PasswordReset',
        index: 'PasswordReset_tokenHash_key',
        columns: ['tokenHash'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PasswordReset',
        foreignKey: {
          name: 'PasswordReset_accountId_fkey',
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
