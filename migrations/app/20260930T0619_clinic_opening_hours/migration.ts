#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0b1cd57301ca424643f8d57385d6122ad907b1c2f7f954dbd5210364ee05a4f9/contract';
import startContract from '../../snapshots/0b1cd57301ca424643f8d57385d6122ad907b1c2f7f954dbd5210364ee05a4f9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c981f5554787b022f55c0cd8958237b1f65e795bb51f2f73942504c41379e12e/contract';
import endContract from '../../snapshots/c981f5554787b022f55c0cd8958237b1f65e795bb51f2f73942504c41379e12e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ClinicOpeningHours',
        columns: [
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('closeMinute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('openMinute', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('weekday', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'ClinicOpeningHours_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClinicOpeningHours',
        index: 'ClinicOpeningHours_clinicId_idx_8f933800',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClinicOpeningHours',
        index: 'ClinicOpeningHours_clinicId_weekday_key',
        columns: ['clinicId', 'weekday'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClinicOpeningHours',
        foreignKey: {
          name: 'ClinicOpeningHours_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
