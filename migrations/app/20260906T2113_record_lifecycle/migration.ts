#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1b83f2d143e2e769cdd1d33191ec2805ace819c0def909b8f7954a9bf4473f14/contract';
import endContract from '../../snapshots/1b83f2d143e2e769cdd1d33191ec2805ace819c0def909b8f7954a9bf4473f14/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b324ebb59c9971d641a4677babf24e9aadc24efca858564483a9a17be7485b65/contract';
import startContract from '../../snapshots/b324ebb59c9971d641a4677babf24e9aadc24efca858564483a9a17be7485b65/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'RecordStatus',
        members: ['DRAFT', 'FINALIZED', 'AMENDED'],
      }),
      this.createTable({
        schema: 'public',
        table: 'MedicalRecordVersion',
        columns: [
          col('authorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('medicalRecordId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('snapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'MedicalRecordVersion_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('archiveReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('archivedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('archivedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('finalizedAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('finalizedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('status', '"RecordStatus"', {
          notNull: true,
          default: lit('FINALIZED'),
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'RecordStatus' } },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalRecord',
        index: 'MedicalRecord_archivedById_idx',
        columns: ['archivedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalRecord',
        index: 'MedicalRecord_finalizedById_idx',
        columns: ['finalizedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalRecordVersion',
        index: 'MedicalRecordVersion_authorId_idx',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalRecordVersion',
        index: 'MedicalRecordVersion_recordId_version_key',
        columns: ['medicalRecordId', 'version'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalRecord',
        foreignKey: {
          name: 'MedicalRecord_archivedById_fkey',
          columns: ['archivedById'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalRecord',
        foreignKey: {
          name: 'MedicalRecord_finalizedById_fkey',
          columns: ['finalizedById'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalRecordVersion',
        foreignKey: {
          name: 'MedicalRecordVersion_medicalRecordId_fkey',
          columns: ['medicalRecordId'],
          references: { schema: 'public', table: 'MedicalRecord', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalRecordVersion',
        foreignKey: {
          name: 'MedicalRecordVersion_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
