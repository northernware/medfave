import "server-only";
import { z } from "zod";
import { orm } from "@/src/prisma/db";
import { instantToDb } from "@/lib/datetime";
import { newId } from "@/lib/ids";
import { tidyName } from "@/lib/names";
import { toFieldErrors, type FormState } from "@/lib/validation";

/*
 * A patient's family list: the people they book for, kept on their own
 * account. Details only, on the account holder's word — it grants nothing at
 * any clinic. Shared by the web and the app's API.
 */

/** Who somebody is to the account holder. "Head of household" is the desk's word, not theirs. */
export const FAMILY_RELATIONSHIPS = ["CHILD", "SPOUSE", "PARENT", "SIBLING", "GRANDPARENT", "OTHER"] as const;

const memberSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  middleName: z.string().trim().max(80).optional().transform((v) => v || null),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  sex: z.enum(["MALE", "FEMALE"], { message: "Choose male or female" }),
  relationship: z.enum(FAMILY_RELATIONSHIPS, { message: "Say who they are to you" }),
});

export type FamilyMemberInput = z.infer<typeof memberSchema>;
export type FamilyMemberRow = FamilyMemberInput & { id: string };

const COLUMNS = ["id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "relationship"] as const;

const shape = (m: { id: string; firstName: string; middleName: string | null; lastName: string; dateOfBirth: unknown; sex: string; relationship: string }): FamilyMemberRow => ({
  id: m.id,
  firstName: m.firstName,
  middleName: m.middleName,
  lastName: m.lastName,
  dateOfBirth: String(m.dateOfBirth).slice(0, 10),
  sex: m.sex as FamilyMemberRow["sex"],
  relationship: m.relationship as FamilyMemberRow["relationship"],
});

function read(input: unknown): { ok: true; data: FamilyMemberInput } | ({ ok: false } & FormState) {
  const parsed = memberSchema.safeParse(input ?? {});
  if (!parsed.success) return { ...toFieldErrors(parsed.error), ok: false };
  if (parsed.data.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return { ok: false, message: "Check the birthday.", fieldErrors: { dateOfBirth: ["Can't be in the future"] } };
  }
  const d = parsed.data;
  return {
    ok: true,
    data: { ...d, firstName: tidyName(d.firstName), middleName: d.middleName ? tidyName(d.middleName) : null, lastName: tidyName(d.lastName) },
  };
}

export async function listFamily(accountId: string): Promise<FamilyMemberRow[]> {
  const rows = await orm.FamilyMember
    .select(...COLUMNS)
    .where((m) => m.accountId.eq(accountId))
    .orderBy((m) => m.createdAt.asc())
    .all();
  return rows.map(shape);
}

/** One of this account's people, or null — never anybody else's. */
export async function familyMember(accountId: string, id: string): Promise<FamilyMemberRow | null> {
  if (!id) return null;
  const row = await orm.FamilyMember
    .select(...COLUMNS)
    .where((m) => m.id.eq(id))
    .where((m) => m.accountId.eq(accountId))
    .first();
  return row ? shape(row) : null;
}

export type FamilyResult = { ok: true; member: FamilyMemberRow } | ({ ok: false } & FormState);

export async function addFamilyMember(accountId: string, input: unknown): Promise<FamilyResult> {
  const r = read(input);
  if (!r.ok) return r;
  const count = (await orm.FamilyMember.select("id").where((m) => m.accountId.eq(accountId)).all()).length;
  if (count >= 20) return { ok: false, message: "That's a big family — 20 people is the most for now." };
  const now = instantToDb(new Date());
  const id = newId();
  await orm.FamilyMember.create({ id, accountId, ...r.data, createdAt: now, updatedAt: now } as Parameters<typeof orm.FamilyMember.create>[0]);
  return { ok: true, member: { id, ...r.data } };
}

export async function updateFamilyMember(accountId: string, id: string, input: unknown): Promise<FamilyResult> {
  if (!(await familyMember(accountId, id))) return { ok: false, message: "Not found." };
  const r = read(input);
  if (!r.ok) return r;
  await orm.FamilyMember.where((m) => m.id.eq(id)).update({ ...r.data, updatedAt: instantToDb(new Date()) } as never);
  return { ok: true, member: { id, ...r.data } };
}

/** Off the list. Requests already sent for them stand; the clinic's chart, if any, is the clinic's. */
export async function removeFamilyMember(accountId: string, id: string): Promise<boolean> {
  if (!(await familyMember(accountId, id))) return false;
  await orm.FamilyMember.where((m) => m.id.eq(id)).delete();
  return true;
}
