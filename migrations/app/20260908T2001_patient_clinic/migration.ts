#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1b972f81e61cb5c479cfa1cbf770712c27cd9e3ff5fc7fe440dfd858a2ded443/contract';
import startContract from '../../snapshots/1b972f81e61cb5c479cfa1cbf770712c27cd9e3ff5fc7fe440dfd858a2ded443/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fed68816db43ccfb05dc8fe3fe40b004bd73e67dcaa0b187e635a9c7f379dcb2/contract';
import endContract from '../../snapshots/fed68816db43ccfb05dc8fe3fe40b004bd73e67dcaa0b187e635a9c7f379dcb2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Patient',
        index: 'Patient_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Patient',
        foreignKey: {
          name: 'Patient_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
