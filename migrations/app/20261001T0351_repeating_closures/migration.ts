#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/673c57b6b3d212b6264b568f99982193cf6501d1b5345b465fd88fc7e6841cbf/contract';
import startContract from '../../snapshots/673c57b6b3d212b6264b568f99982193cf6501d1b5345b465fd88fc7e6841cbf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b82f2892320cb0910011428e977d7aecc097880eb015f000423c0b0883280030/contract';
import endContract from '../../snapshots/b82f2892320cb0910011428e977d7aecc097880eb015f000423c0b0883280030/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ClinicClosure',
        column: col('repeat', 'text', {
          notNull: true,
          default: lit('NONE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
