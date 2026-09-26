#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2e49b045bcc02cd7edd66eeba3dd8496713e77369e239480b253c5ccd52f86fe/contract';
import startContract from '../../snapshots/2e49b045bcc02cd7edd66eeba3dd8496713e77369e239480b253c5ccd52f86fe/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e75416a5a298c4b2d01a62239e29682e752b50c0147a20dbb7ca0ddcd9a0454d/contract';
import endContract from '../../snapshots/e75416a5a298c4b2d01a62239e29682e752b50c0147a20dbb7ca0ddcd9a0454d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('confirmationSentAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('reminderSentAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
