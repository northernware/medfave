import "dotenv/config";
import { orm } from "./db";

/*
 * Makes an account a Medfave platform admin: it can verify doctors at
 * /admin/verify. Deliberately a script and not a page, so no web request can
 * ever grant it. `--revoke` takes it away.
 *
 *   npm run admin:grant -- someone@example.com [--revoke]
 */

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes("--revoke");
if (!email || email.startsWith("--")) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}

async function main() {
  const account = await orm.Account.select("id", "fullName").where((a) => a.email.eq(email)).first();
  if (!account) {
    console.error(`No account for ${email}. Sign up first, then run this again.`);
    process.exit(1);
  }
  await orm.Account.where((a) => a.id.eq(account.id)).update({ platformAdmin: !revoke });
  console.log(`${account.fullName} <${email}> ${revoke ? "is no longer" : "is now"} a platform admin.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
