#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/597e8d38eb71538e04e60a7a3338056cc9cd81221d73b9fa04dd8b60accb6162/contract';
import endContract from '../../snapshots/597e8d38eb71538e04e60a7a3338056cc9cd81221d73b9fa04dd8b60accb6162/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a1691519be19b68ea63b9337f39f9be2e78e4c31871f55d91217d68691f34d3e/contract';
import startContract from '../../snapshots/a1691519be19b68ea63b9337f39f9be2e78e4c31871f55d91217d68691f34d3e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newContactNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newDateOfBirth', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newFirstName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newLastName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newMiddleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newSex', '"Sex"', {
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Sex' } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Clinic',
        column: col('listed', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Clinic',
        column: col('slug', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'AppointmentRequest', column: 'patientId' }),
      this.createIndex({
        schema: 'public',
        table: 'Clinic',
        index: 'Clinic_slug_key',
        columns: ['slug'],
        extras: { unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
