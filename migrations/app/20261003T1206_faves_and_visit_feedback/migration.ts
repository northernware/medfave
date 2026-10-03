#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3052c604611e2abdc9f5a14149e2d70e572b39d64a045a6be05e49bd54138cfe/contract';
import endContract from '../../snapshots/3052c604611e2abdc9f5a14149e2d70e572b39d64a045a6be05e49bd54138cfe/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/daa1a904f198b0b801df854978ecc00d7c24d2ad1a698d1260338958256b26b9/contract';
import startContract from '../../snapshots/daa1a904f198b0b801df854978ecc00d7c24d2ad1a698d1260338958256b26b9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'VisitRating',
        members: ['GOOD', 'NOT_GREAT'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Fave',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('doctorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'Fave_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'VisitFeedback',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('appointmentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('doctorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rating', '"VisitRating"', {
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'VisitRating' } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'VisitFeedback_pkey' })],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Fave',
        constraint: 'Fave_accountId_doctorId_key',
        columns: ['accountId', 'doctorId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'VisitFeedback',
        constraint: 'VisitFeedback_appointmentId_accountId_key',
        columns: ['appointmentId', 'accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Fave',
        index: 'Fave_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Fave',
        index: 'Fave_doctorId_idx',
        columns: ['doctorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitFeedback',
        index: 'VisitFeedback_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitFeedback',
        index: 'VisitFeedback_appointmentId_idx_682a8b58',
        columns: ['appointmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitFeedback',
        index: 'VisitFeedback_clinicId_createdAt_idx',
        columns: ['clinicId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitFeedback',
        index: 'VisitFeedback_clinicId_idx_8f933800',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VisitFeedback',
        index: 'VisitFeedback_doctorId_idx',
        columns: ['doctorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Fave',
        foreignKey: {
          name: 'Fave_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Fave',
        foreignKey: {
          name: 'Fave_doctorId_fkey',
          columns: ['doctorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VisitFeedback',
        foreignKey: {
          name: 'VisitFeedback_appointmentId_fkey',
          columns: ['appointmentId'],
          references: { schema: 'public', table: 'Appointment', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VisitFeedback',
        foreignKey: {
          name: 'VisitFeedback_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VisitFeedback',
        foreignKey: {
          name: 'VisitFeedback_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VisitFeedback',
        foreignKey: {
          name: 'VisitFeedback_doctorId_fkey',
          columns: ['doctorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
