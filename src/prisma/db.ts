import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "./contract.json";
import type { Contract } from "./contract";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }

  return postgres<Contract>({
    contractJson,
    url,
    poolOptions: {
      // Retire idle connections before the server does. A pooled endpoint closes
      // idle sockets on its own schedule; without a shorter timeout here the pool
      // keeps handing out connections the far end has already hung up on, which
      // surfaces as an intermittent ConnectionClosed on whichever request happens
      // to draw the dead one. The façade does not expose a max-connections field —
      // pass your own pg.Pool via `pg:` if that needs tuning.
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
  });
}

// Next.js re-evaluates modules on hot reload; without the global we would open a
// new connection pool on every save. The pool lives for the process lifetime and
// is never closed per-request.
//
// The cached client is kept per schema version. It is built from the contract,
// so after a schema change (a new table, a new column) the old client doesn't
// know about them, and a dev server that has been running since before would
// fail until restarted. Keyed on the contract's storage hash, a changed schema
// gets a fresh client on the next reload instead.
const globalForDb = globalThis as unknown as { db?: Db; dbSchema?: string };
const schema = (contractJson as { storage?: { storageHash?: string } }).storage?.storageHash ?? "";

let client: Db | undefined;

function getDb(): Db {
  client ??= globalForDb.db && globalForDb.dbSchema === schema ? globalForDb.db : createDb();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.db = client;
    globalForDb.dbSchema = schema;
  }
  return client;
}

/**
 * Importing this module must not read the environment.
 *
 * `next build` loads every page module to collect its config, and a deploy
 * target supplies DATABASE_URL only when the service actually runs — so reading
 * it at import time failed the build before a single request existed. The client
 * is therefore built on first use, behind proxies that keep `db.orm`,
 * `db.transaction` and the rest reading as ordinary values at the call sites.
 * Constructing it still opens no connection; the pool is created lazily by the
 * first query, as it was before.
 */
function lazily<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const source = resolve();
      const value = Reflect.get(source, property, source);
      return typeof value === "function" ? value.bind(source) : value;
    },
    has: (_target, property) => property in resolve(),
  });
}

export const db = lazily(getDb);

// The contract declares one namespace, `public`, so every model is addressed as
// `db.orm.public.<Model>`. Bind it once here and the call sites read `orm.Patient`.
// Inside a transaction the same coordinate applies: `tx.orm.public.<Model>`.
export const orm = lazily(() => getDb().orm.public);
