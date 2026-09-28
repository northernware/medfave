#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/605d56444bc1f1b7a8069b89844cf5f88165e9da18a1d0f97b7250e926acfa06/contract';
import startContract from '../../snapshots/605d56444bc1f1b7a8069b89844cf5f88165e9da18a1d0f97b7250e926acfa06/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6dc60cf3b4ad2e98d8a1bd803da67c14a4595a7f5c8c8a4b548d92ee73d02ead/contract';
import endContract from '../../snapshots/6dc60cf3b4ad2e98d8a1bd803da67c14a4595a7f5c8c8a4b548d92ee73d02ead/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

/**
 * One login, many clinics (PRODUCT.md, decision 4).
 *
 * A patient's login could hold one chart, so somebody seen at a second clinic
 * needed a second login. Now a login may be linked to a chart at each clinic —
 * still never two at the same clinic, which the new unique constraint keeps.
 * Existing links satisfy it as they stand: each login had one chart.
 */
export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'Patient',
        constraint: 'Patient_accountId_key',
      }),
      this.addUnique({
        schema: 'public',
        table: 'Patient',
        constraint: 'Patient_accountId_clinicId_key',
        columns: ['accountId', 'clinicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Patient',
        index: 'Patient_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
