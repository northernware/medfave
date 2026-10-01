#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c1f6462a5eb3779d1b24f6bbcd0e4aa2b459c249c12e570f260a825d0ef9378b/contract';
import startContract from '../../snapshots/c1f6462a5eb3779d1b24f6bbcd0e4aa2b459c249c12e570f260a825d0ef9378b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e8befc5b48a6d344d614e64abb0f3969c7e1cea35103eec16e71f7e121cff755/contract';
import endContract from '../../snapshots/e8befc5b48a6d344d614e64abb0f3969c7e1cea35103eec16e71f7e121cff755/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('rescheduleOfId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Clinic',
        column: col('patientCancelHours', 'int4', {
          notNull: true,
          default: lit(2),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
