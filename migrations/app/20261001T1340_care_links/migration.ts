#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0b2b4b32fe5e85628f657cb59f235c4de2ed33e778bdea58eedf804597e24394/contract';
import startContract from '../../snapshots/0b2b4b32fe5e85628f657cb59f235c4de2ed33e778bdea58eedf804597e24394/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/66cf85b74216c519d2a40d235978a83d10d2837f78589e79296b897a2ff93483/contract';
import endContract from '../../snapshots/66cf85b74216c519d2a40d235978a83d10d2837f78589e79296b897a2ff93483/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'CareLink',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('caregiverName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('grantedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('revokedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'CareLink_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientActivation',
        column: col('caregiverName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PatientActivation',
        column: col('forCaregiver', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'CareLink',
        index: 'CareLink_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CareLink',
        index: 'CareLink_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CareLink',
        index: 'CareLink_grantedById_idx',
        columns: ['grantedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CareLink',
        index: 'CareLink_patientId_idx',
        columns: ['patientId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CareLink',
        foreignKey: {
          name: 'CareLink_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CareLink',
        foreignKey: {
          name: 'CareLink_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CareLink',
        foreignKey: {
          name: 'CareLink_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CareLink',
        foreignKey: {
          name: 'CareLink_grantedById_fkey',
          columns: ['grantedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
