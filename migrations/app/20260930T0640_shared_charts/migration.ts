#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a1691519be19b68ea63b9337f39f9be2e78e4c31871f55d91217d68691f34d3e/contract';
import endContract from '../../snapshots/a1691519be19b68ea63b9337f39f9be2e78e4c31871f55d91217d68691f34d3e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c981f5554787b022f55c0cd8958237b1f65e795bb51f2f73942504c41379e12e/contract';
import startContract from '../../snapshots/c981f5554787b022f55c0cd8958237b1f65e795bb51f2f73942504c41379e12e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ChartAccess',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('openedAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recordId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'ChartAccess_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Clinic',
        column: col('sharedCharts', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChartAccess',
        index: 'ChartAccess_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChartAccess',
        index: 'ChartAccess_clinicId_idx_8f933800',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChartAccess',
        index: 'ChartAccess_patientId_idx_e5f07e88',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChartAccess',
        index: 'ChartAccess_patientId_openedAt_idx',
        columns: ['patientId', 'openedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChartAccess',
        foreignKey: {
          name: 'ChartAccess_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChartAccess',
        foreignKey: {
          name: 'ChartAccess_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChartAccess',
        foreignKey: {
          name: 'ChartAccess_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
