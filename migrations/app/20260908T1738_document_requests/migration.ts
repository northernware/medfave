#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3bbc281657d5ae18c0040cc2d0701b2f0b9006068ab1325c6a96a8f08cf9d131/contract';
import startContract from '../../snapshots/3bbc281657d5ae18c0040cc2d0701b2f0b9006068ab1325c6a96a8f08cf9d131/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a6409fc0ac810c5dcc352f6d4851cff6a1763e0b303f1ea7c371282fc14634dd/contract';
import endContract from '../../snapshots/a6409fc0ac810c5dcc352f6d4851cff6a1763e0b303f1ea7c371282fc14634dd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'DocumentRequestStatus',
        members: ['REQUESTED', 'READY', 'RELEASED', 'DECLINED'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'DocumentType',
        members: [
          'MEDICAL_CERTIFICATE',
          'MEDICAL_ABSTRACT',
          'MEDICO_LEGAL_CERTIFICATE',
          'INSURANCE_CLAIM',
          'RECORD_COPIES',
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'DocumentRequest',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('declineReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('doctorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('medicalRecordId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('releasedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('releasedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('releasedTo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requesterName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requesterRelation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"DocumentRequestStatus"', {
            notNull: true,
            default: lit('REQUESTED'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'DocumentRequestStatus' } },
          }),
          col('type', '"DocumentType"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'DocumentType' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'DocumentRequest_pkey' })],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_doctorId_idx_04369053',
        columns: ['doctorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_doctorId_status_idx',
        columns: ['doctorId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_medicalRecordId_idx',
        columns: ['medicalRecordId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_patientId_idx',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_releasedById_idx',
        columns: ['releasedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DocumentRequest',
        foreignKey: {
          name: 'DocumentRequest_doctorId_fkey',
          columns: ['doctorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DocumentRequest',
        foreignKey: {
          name: 'DocumentRequest_releasedById_fkey',
          columns: ['releasedById'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DocumentRequest',
        foreignKey: {
          name: 'DocumentRequest_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DocumentRequest',
        foreignKey: {
          name: 'DocumentRequest_medicalRecordId_fkey',
          columns: ['medicalRecordId'],
          references: { schema: 'public', table: 'MedicalRecord', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
