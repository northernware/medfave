#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b82f2892320cb0910011428e977d7aecc097880eb015f000423c0b0883280030/contract';
import startContract from '../../snapshots/b82f2892320cb0910011428e977d7aecc097880eb015f000423c0b0883280030/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c1f6462a5eb3779d1b24f6bbcd0e4aa2b459c249c12e570f260a825d0ef9378b/contract';
import endContract from '../../snapshots/c1f6462a5eb3779d1b24f6bbcd0e4aa2b459c249c12e570f260a825d0ef9378b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ScheduleSettings',
        column: col('observeHolidays', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
