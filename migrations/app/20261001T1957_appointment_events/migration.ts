#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/96ffb42c7bc4dfaa3789264493231f88ba00a952c3f40d439adfe1a31fbe55b5/contract';
import endContract from '../../snapshots/96ffb42c7bc4dfaa3789264493231f88ba00a952c3f40d439adfe1a31fbe55b5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ff654226d50412675f6e62a29593a1bfae82b2f6154ed1986f701425290c22cd/contract';
import startContract from '../../snapshots/ff654226d50412675f6e62a29593a1bfae82b2f6154ed1986f701425290c22cd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AppointmentEvent',
        columns: [
          col('appointmentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('at', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('byId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('previousScheduledAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('status', '"AppointmentStatus"', {
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'AppointmentStatus' } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'AppointmentEvent_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentEvent',
        index: 'AppointmentEvent_appointmentId_idx',
        columns: ['appointmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentEvent',
        index: 'AppointmentEvent_byId_idx',
        columns: ['byId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentEvent',
        foreignKey: {
          name: 'AppointmentEvent_appointmentId_fkey',
          columns: ['appointmentId'],
          references: { schema: 'public', table: 'Appointment', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentEvent',
        foreignKey: {
          name: 'AppointmentEvent_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentEvent',
        foreignKey: {
          name: 'AppointmentEvent_byId_fkey',
          columns: ['byId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
