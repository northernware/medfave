#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2f520a5f5aacacc08411744686193f10454fe5ccddc6338b1b8fa82ddc601494/contract';
import startContract from '../../snapshots/2f520a5f5aacacc08411744686193f10454fe5ccddc6338b1b8fa82ddc601494/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e133f779980eb18bb2cf07d057f5a048c1a135d5c1d51e39100c2cf2b6a020ba/contract';
import endContract from '../../snapshots/e133f779980eb18bb2cf07d057f5a048c1a135d5c1d51e39100c2cf2b6a020ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('reminderPreference', '"ReminderPreference"', {
          notNull: true,
          default: lit('NONE'),
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'ReminderPreference' } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
