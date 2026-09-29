#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/30a9ed7f15ffe62b3a0b880fcb853ad560092462b1374bab2c7eb48e2a3cb5be/contract';
import startContract from '../../snapshots/30a9ed7f15ffe62b3a0b880fcb853ad560092462b1374bab2c7eb48e2a3cb5be/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/46d6038ae2dabe39a7ee5a0a24e88afe6554c9f1b850d37cf36ffd638796ae39/contract';
import endContract from '../../snapshots/46d6038ae2dabe39a7ee5a0a24e88afe6554c9f1b850d37cf36ffd638796ae39/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'IdentityProvider',
        members: ['GOOGLE'],
      }),
      this.createTable({
        schema: 'public',
        table: 'AccountIdentity',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', '"IdentityProvider"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'IdentityProvider' } },
          }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'AccountIdentity_pkey' })],
      }),
      this.dropNotNull({ schema: 'public', table: 'Account', column: 'passwordHash' }),
      this.createIndex({
        schema: 'public',
        table: 'AccountIdentity',
        index: 'AccountIdentity_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AccountIdentity',
        index: 'AccountIdentity_provider_subject_key',
        columns: ['provider', 'subject'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AccountIdentity',
        foreignKey: {
          name: 'AccountIdentity_accountId_fkey',
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
