#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/360c574596fd67e27e8a8f998e0df167a69871e5d871c6c388e7d7eb75ac4e9b/contract';
import startContract from '../../snapshots/360c574596fd67e27e8a8f998e0df167a69871e5d871c6c388e7d7eb75ac4e9b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/daa1a904f198b0b801df854978ecc00d7c24d2ad1a698d1260338958256b26b9/contract';
import endContract from '../../snapshots/daa1a904f198b0b801df854978ecc00d7c24d2ad1a698d1260338958256b26b9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('primaryDoctorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Patient',
        index: 'Patient_primaryDoctorId_idx_46462886',
        columns: ['primaryDoctorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Patient',
        foreignKey: {
          name: 'Patient_primaryDoctorId_fkey',
          columns: ['primaryDoctorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
