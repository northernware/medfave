#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/142b1021ecbc1dc68d2d50077fcab5a38ca3be6580f2614641a2b9c725a0c2bf/contract';
import startContract from '../../snapshots/142b1021ecbc1dc68d2d50077fcab5a38ca3be6580f2614641a2b9c725a0c2bf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b324ebb59c9971d641a4677babf24e9aadc24efca858564483a9a17be7485b65/contract';
import endContract from '../../snapshots/b324ebb59c9971d641a4677babf24e9aadc24efca858564483a9a17be7485b65/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addNativeEnumValue({
        schema: 'public',
        typeName: 'AppointmentStatus',
        value: 'IN_CONSULTATION',
      }),
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('consultationStartedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
