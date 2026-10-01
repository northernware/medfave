#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/66cf85b74216c519d2a40d235978a83d10d2837f78589e79296b897a2ff93483/contract';
import startContract from '../../snapshots/66cf85b74216c519d2a40d235978a83d10d2837f78589e79296b897a2ff93483/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ff654226d50412675f6e62a29593a1bfae82b2f6154ed1986f701425290c22cd/contract';
import endContract from '../../snapshots/ff654226d50412675f6e62a29593a1bfae82b2f6154ed1986f701425290c22cd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'FamilyMember',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dateOfBirth', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('middleName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('relationship', '"Relationship"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Relationship' } },
          }),
          col('sex', '"Sex"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Sex' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'FamilyMember_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('familyMemberId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('forOther', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AppointmentRequest',
        column: col('newRelationship', '"Relationship"', {
          codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Relationship' } },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_familyMemberId_idx_ddb6e46b',
        columns: ['familyMemberId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FamilyMember',
        index: 'FamilyMember_accountId_idx',
        columns: ['accountId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FamilyMember',
        foreignKey: {
          name: 'FamilyMember_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_familyMemberId_fkey',
          columns: ['familyMemberId'],
          references: { schema: 'public', table: 'FamilyMember', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
