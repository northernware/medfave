#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2e49b045bcc02cd7edd66eeba3dd8496713e77369e239480b253c5ccd52f86fe/contract';
import endContract from '../../snapshots/2e49b045bcc02cd7edd66eeba3dd8496713e77369e239480b253c5ccd52f86fe/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fed68816db43ccfb05dc8fe3fe40b004bd73e67dcaa0b187e635a9c7f379dcb2/contract';
import startContract from '../../snapshots/fed68816db43ccfb05dc8fe3fe40b004bd73e67dcaa0b187e635a9c7f379dcb2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: 'public', table: 'Doctor', column: 'passwordHash' }),
      this.dropIndex({ schema: 'public', table: 'Doctor', index: 'Doctor_email_key' }),
      this.dropColumn({ schema: 'public', table: 'Doctor', column: 'email' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
