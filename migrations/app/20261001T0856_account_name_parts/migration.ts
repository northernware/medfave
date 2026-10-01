#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0b2b4b32fe5e85628f657cb59f235c4de2ed33e778bdea58eedf804597e24394/contract';
import endContract from '../../snapshots/0b2b4b32fe5e85628f657cb59f235c4de2ed33e778bdea58eedf804597e24394/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e8befc5b48a6d344d614e64abb0f3969c7e1cea35103eec16e71f7e121cff755/contract';
import startContract from '../../snapshots/e8befc5b48a6d344d614e64abb0f3969c7e1cea35103eec16e71f7e121cff755/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('firstName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('lastName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Account',
        column: col('middleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
