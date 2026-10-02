#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/96ffb42c7bc4dfaa3789264493231f88ba00a952c3f40d439adfe1a31fbe55b5/contract';
import startContract from '../../snapshots/96ffb42c7bc4dfaa3789264493231f88ba00a952c3f40d439adfe1a31fbe55b5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e53313c2c2de4a6a7d1ce3185d44bddbf117b05d3cd945faade51d574e1887aa/contract';
import endContract from '../../snapshots/e53313c2c2de4a6a7d1ce3185d44bddbf117b05d3cd945faade51d574e1887aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'CareLink',
        column: col('familyMemberId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'CareLink',
        index: 'CareLink_familyMemberId_idx',
        columns: ['familyMemberId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CareLink',
        foreignKey: {
          name: 'CareLink_familyMemberId_fkey',
          columns: ['familyMemberId'],
          references: { schema: 'public', table: 'FamilyMember', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
