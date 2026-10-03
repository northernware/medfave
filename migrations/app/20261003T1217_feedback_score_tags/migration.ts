#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3052c604611e2abdc9f5a14149e2d70e572b39d64a045a6be05e49bd54138cfe/contract';
import startContract from '../../snapshots/3052c604611e2abdc9f5a14149e2d70e572b39d64a045a6be05e49bd54138cfe/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/db5065a364bcc03314531fde6adda919a531c985214eea7b0752035425cdd9be/contract';
import endContract from '../../snapshots/db5065a364bcc03314531fde6adda919a531c985214eea7b0752035425cdd9be/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'VisitFeedback',
        column: col('score', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'VisitFeedback',
        column: col('tags', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
