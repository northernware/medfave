import "dotenv/config";
import { orm } from "./db";
import { namePartsOf } from "../../lib/names";

/*
 * Fills Account.firstName / middleName / lastName for accounts made before the
 * parts were kept, from their full name: title dropped, last word as the last
 * name. A best guess ("Dela Cruz" is two words) — people can correct it on the
 * account page. Only touches accounts with no first name yet; safe to rerun.
 *
 *   npm run db:backfill-names
 */
async function main() {
  const rows = await orm.Account.select("id", "fullName").where((a) => a.firstName.isNull()).all();
  for (const r of rows) {
    await orm.Account.where((a) => a.id.eq(r.id)).update(namePartsOf({ fullName: r.fullName }));
  }
  console.log(`Filled name parts for ${rows.length} account(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
