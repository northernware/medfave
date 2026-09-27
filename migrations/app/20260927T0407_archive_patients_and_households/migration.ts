#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/de655cbcb1bb114475992da00bf148113c9d29085aafc79d15ae38cffb15b364/contract';
import endContract from '../../snapshots/de655cbcb1bb114475992da00bf148113c9d29085aafc79d15ae38cffb15b364/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e133f779980eb18bb2cf07d057f5a048c1a135d5c1d51e39100c2cf2b6a020ba/contract';
import startContract from '../../snapshots/e133f779980eb18bb2cf07d057f5a048c1a135d5c1d51e39100c2cf2b6a020ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Household',
        column: col('archiveReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Household',
        column: col('archivedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Household',
        column: col('archivedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('archiveReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('archivedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('archivedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
