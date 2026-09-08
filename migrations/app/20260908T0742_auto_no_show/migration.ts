#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1b83f2d143e2e769cdd1d33191ec2805ace819c0def909b8f7954a9bf4473f14/contract';
import startContract from '../../snapshots/1b83f2d143e2e769cdd1d33191ec2805ace819c0def909b8f7954a9bf4473f14/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3bbc281657d5ae18c0040cc2d0701b2f0b9006068ab1325c6a96a8f08cf9d131/contract';
import endContract from '../../snapshots/3bbc281657d5ae18c0040cc2d0701b2f0b9006068ab1325c6a96a8f08cf9d131/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('autoNoShowAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
