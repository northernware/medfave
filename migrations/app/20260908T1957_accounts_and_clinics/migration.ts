#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1b972f81e61cb5c479cfa1cbf770712c27cd9e3ff5fc7fe440dfd858a2ded443/contract';
import endContract from '../../snapshots/1b972f81e61cb5c479cfa1cbf770712c27cd9e3ff5fc7fe440dfd858a2ded443/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a6409fc0ac810c5dcc352f6d4851cff6a1763e0b303f1ea7c371282fc14634dd/contract';
import startContract from '../../snapshots/a6409fc0ac810c5dcc352f6d4851cff6a1763e0b303f1ea7c371282fc14634dd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'AppointmentRequestStatus',
        members: ['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'ClinicRole',
        members: ['DOCTOR', 'SECRETARY', 'ADMIN'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Account',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fullName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'Account_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'AppointmentRequest',
        columns: [
          col('appointmentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('decidedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('decidedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('decisionNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('doctorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('preferredDate', 'date', {
            notNull: true,
            codecRef: { codecId: 'pg/date-string@1' },
          }),
          col('preferredTime', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('service', '"ServiceType"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'ServiceType' } },
          }),
          col('status', '"AppointmentRequestStatus"', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: {
              codecId: 'pg/enum@1',
              typeParams: { typeName: 'AppointmentRequestStatus' },
            },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'AppointmentRequest_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'Clinic',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('contactNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'Clinic_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'ClinicMember',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', '"ClinicRole"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'ClinicRole' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'ClinicMember_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'PatientActivation',
        columns: [
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('expiresAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issuedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('patientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'], { name: 'PatientActivation_pkey' })],
      }),
      this.createTable({
        schema: 'public',
        table: 'StaffInvite',
        columns: [
          col('acceptedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('acceptedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clinicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invitedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('role', '"ClinicRole"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'ClinicRole' } },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'], { name: 'StaffInvite_pkey' })],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('bookedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Appointment',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('accountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Doctor',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'DocumentRequest',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'DocumentRequest',
        column: col('sharedWithPatientAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Household',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'MedicalRecord',
        column: col('clinicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Patient',
        column: col('accountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Doctor',
        constraint: 'Doctor_accountId_key',
        columns: ['accountId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Patient',
        constraint: 'Patient_accountId_key',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Account',
        index: 'Account_email_key',
        columns: ['email'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'Appointment_bookedById_idx',
        columns: ['bookedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'Appointment_clinicId_idx_8f933800',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'Appointment_clinicId_scheduledAt_idx',
        columns: ['clinicId', 'scheduledAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_appointmentId_idx',
        columns: ['appointmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_clinicId_status_idx',
        columns: ['clinicId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_decidedById_idx',
        columns: ['decidedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_doctorId_idx',
        columns: ['doctorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_patientId_idx',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AppointmentRequest',
        index: 'AppointmentRequest_requestedById_idx',
        columns: ['requestedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClinicMember',
        index: 'ClinicMember_accountId_idx',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClinicMember',
        index: 'ClinicMember_clinicId_accountId_key',
        columns: ['clinicId', 'accountId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Doctor',
        index: 'Doctor_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_clinicId_idx_8f933800',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DocumentRequest',
        index: 'DocumentRequest_clinicId_status_idx',
        columns: ['clinicId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Household',
        index: 'Household_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MedicalRecord',
        index: 'MedicalRecord_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientActivation',
        index: 'PatientActivation_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientActivation',
        index: 'PatientActivation_issuedById_idx',
        columns: ['issuedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientActivation',
        index: 'PatientActivation_patientId_idx',
        columns: ['patientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PatientActivation',
        index: 'PatientActivation_tokenHash_key',
        columns: ['tokenHash'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'StaffInvite',
        index: 'StaffInvite_acceptedById_idx',
        columns: ['acceptedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'StaffInvite',
        index: 'StaffInvite_clinicId_idx',
        columns: ['clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'StaffInvite',
        index: 'StaffInvite_invitedById_idx',
        columns: ['invitedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'StaffInvite',
        index: 'StaffInvite_tokenHash_key',
        columns: ['tokenHash'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Appointment',
        foreignKey: {
          name: 'Appointment_bookedById_fkey',
          columns: ['bookedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_doctorId_fkey',
          columns: ['doctorId'],
          references: { schema: 'public', table: 'Doctor', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_requestedById_fkey',
          columns: ['requestedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_decidedById_fkey',
          columns: ['decidedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AppointmentRequest',
        foreignKey: {
          name: 'AppointmentRequest_appointmentId_fkey',
          columns: ['appointmentId'],
          references: { schema: 'public', table: 'Appointment', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Appointment',
        foreignKey: {
          name: 'Appointment_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClinicMember',
        foreignKey: {
          name: 'ClinicMember_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClinicMember',
        foreignKey: {
          name: 'ClinicMember_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Doctor',
        foreignKey: {
          name: 'Doctor_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Doctor',
        foreignKey: {
          name: 'Doctor_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DocumentRequest',
        foreignKey: {
          name: 'DocumentRequest_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Household',
        foreignKey: {
          name: 'Household_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MedicalRecord',
        foreignKey: {
          name: 'MedicalRecord_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Patient',
        foreignKey: {
          name: 'Patient_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientActivation',
        foreignKey: {
          name: 'PatientActivation_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientActivation',
        foreignKey: {
          name: 'PatientActivation_patientId_fkey',
          columns: ['patientId'],
          references: { schema: 'public', table: 'Patient', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PatientActivation',
        foreignKey: {
          name: 'PatientActivation_issuedById_fkey',
          columns: ['issuedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StaffInvite',
        foreignKey: {
          name: 'StaffInvite_clinicId_fkey',
          columns: ['clinicId'],
          references: { schema: 'public', table: 'Clinic', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StaffInvite',
        foreignKey: {
          name: 'StaffInvite_invitedById_fkey',
          columns: ['invitedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'StaffInvite',
        foreignKey: {
          name: 'StaffInvite_acceptedById_fkey',
          columns: ['acceptedById'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
