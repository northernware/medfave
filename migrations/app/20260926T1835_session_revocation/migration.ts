#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b86db92d58069683062bf34dabdb270707fd6c634aa74011285cf01560cd52e9/contract';
import endContract from '../../snapshots/b86db92d58069683062bf34dabdb270707fd6c634aa74011285cf01560cd52e9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e75416a5a298c4b2d01a62239e29682e752b50c0147a20dbb7ca0ddcd9a0454d/contract';
import startContract from '../../snapshots/e75416a5a298c4b2d01a62239e29682e752b50c0147a20dbb7ca0ddcd9a0454d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('sessionsValidFrom', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
