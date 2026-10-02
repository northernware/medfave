#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/360c574596fd67e27e8a8f998e0df167a69871e5d871c6c388e7d7eb75ac4e9b/contract';
import endContract from '../../snapshots/360c574596fd67e27e8a8f998e0df167a69871e5d871c6c388e7d7eb75ac4e9b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e53313c2c2de4a6a7d1ce3185d44bddbf117b05d3cd945faade51d574e1887aa/contract';
import startContract from '../../snapshots/e53313c2c2de4a6a7d1ce3185d44bddbf117b05d3cd945faade51d574e1887aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('emergencyContact2Name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('emergencyContact2Number', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('emergencyContact2Relationship', 'text', {
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
