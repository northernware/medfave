#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/597e8d38eb71538e04e60a7a3338056cc9cd81221d73b9fa04dd8b60accb6162/contract';
import startContract from '../../snapshots/597e8d38eb71538e04e60a7a3338056cc9cd81221d73b9fa04dd8b60accb6162/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/673c57b6b3d212b6264b568f99982193cf6501d1b5345b465fd88fc7e6841cbf/contract';
import endContract from '../../snapshots/673c57b6b3d212b6264b568f99982193cf6501d1b5345b465fd88fc7e6841cbf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'PatientActivation',
        column: col('pinExpiresAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientActivation',
        column: col('pinHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientActivation',
        index: 'PatientActivation_pinHash_idx',
        columns: ['pinHash'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
