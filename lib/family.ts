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
/**
 * One person in the family. `links`: their charts at clinics this login looks
 * after; once there is one, the clinic's record is the truth for their name,
 * birthday and sex, and those come from it here.
 */
export type FamilyMemberRow = FamilyMemberInput & {
  id: string;
  links: { patientId: string; clinicId: string; clinicName: string }[];
};

const COLUMNS = ["id", "firstName", "middleName", "lastName", "dateOfBirth", "sex", "relationship"] as const;

const shape = (m: { id: string; firstName: string; middleName: string | null; lastName: string; dateOfBirth: unknown; sex: string; relationship: string }): FamilyMemberRow => ({
  links: [],
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

/**
 * Every chart this login looks after has an entry in its family list: the
 * same person, whichever side started it. A clinic-made link (a caregiver
 * code, an adult's own say-so) is matched to an entry with the same name and
 * birthday, or gets a new one from the clinic's chart. Run on every read, so
 * a link made anywhere lands in the list.
 */
async function attachLinks(accountId: string) {
  const loose = await orm.CareLink
    .select("id", "patientId")
    .include("patient", (p) => p.select("firstName", "middleName", "lastName", "dateOfBirth", "sex", "householdId", "relationship"))
    .where((l) => l.accountId.eq(accountId))
    .where((l) => l.revokedAt.isNull())
    .where((l) => l.familyMemberId.isNull())
    .all();
  if (loose.length === 0) return;
  // Their own charts, to read who somebody is to them from a shared household.
  const own = await orm.Patient.select("householdId", "relationship").where((p) => p.accountId.eq(accountId)).all();
  const relationTo = (p: { householdId: string; relationship: string }) => {
    const me = own.find((o) => o.householdId === p.householdId);
    if (!me) return "OTHER" as const;
    const parent = me.relationship === "HEAD" || me.relationship === "SPOUSE";
    if (parent && p.relationship === "CHILD") return "CHILD" as const;
    if (parent && (p.relationship === "HEAD" || p.relationship === "SPOUSE")) return "SPOUSE" as const;
    if (me.relationship === "CHILD" && (p.relationship === "HEAD" || p.relationship === "SPOUSE")) return "PARENT" as const;
    if (me.relationship === p.relationship && p.relationship === "CHILD") return "SIBLING" as const;
    if (parent && p.relationship === "GRANDPARENT") return "PARENT" as const;
    return "OTHER" as const;
  };
  const members = await orm.FamilyMember
    .select("id", "firstName", "lastName", "dateOfBirth")
    .where((m) => m.accountId.eq(accountId))
    .all();
  const key = (first: string, last: string, born: unknown) =>
    `${first} ${last} ${String(born).slice(0, 10)}`.trim().toLowerCase().replace(/\s+/g, " ");
  for (const link of loose) {
    const p = link.patient;
    const same = members.find((m) => key(m.firstName, m.lastName, m.dateOfBirth) === key(p.firstName, p.lastName, p.dateOfBirth));
    let memberId = same?.id;
    if (!memberId) {
      const now = instantToDb(new Date());
      memberId = newId();
      await orm.FamilyMember.create({
        id: memberId,
        accountId,
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth,
        sex: p.sex,
        // Read from a household they share; otherwise theirs to say.
        relationship: relationTo(p),
        createdAt: now,
        updatedAt: now,
      } as Parameters<typeof orm.FamilyMember.create>[0]);
      members.push({ id: memberId, firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth });
    }
    await orm.CareLink.where((l) => l.id.eq(link.id)).update({ familyMemberId: memberId });
  }
}

export async function listFamily(accountId: string): Promise<FamilyMemberRow[]> {
  await attachLinks(accountId);
  const rows = await orm.FamilyMember
    .select(...COLUMNS)
    .include("links", (l) =>
      l
        .select("patientId", "clinicId", "revokedAt")
        .include("clinic", (c) => c.select("name"))
        .include("patient", (p) => p.select("firstName", "middleName", "lastName", "dateOfBirth", "sex", "archivedAt")),
    )
    .where((m) => m.accountId.eq(accountId))
    .orderBy((m) => m.createdAt.asc())
    .all();
  return rows.map((m) => {
    const live = m.links.filter((l) => !l.revokedAt && !l.patient.archivedAt);
    // Linked: the clinic's record is the truth for who they are.
    const chart = live[0]?.patient;
    const row = shape(chart ? { ...m, firstName: chart.firstName, middleName: chart.middleName, lastName: chart.lastName, dateOfBirth: chart.dateOfBirth, sex: chart.sex } : m);
    return { ...row, links: live.map((l) => ({ patientId: l.patientId, clinicId: l.clinicId, clinicName: l.clinic.name })) };
  });
}

/** One of this account's people, or null — never anybody else's. */
export async function familyMember(accountId: string, id: string): Promise<FamilyMemberRow | null> {
  if (!id) return null;
  return (await listFamily(accountId)).find((m) => m.id === id) ?? null;
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
  return { ok: true, member: { id, ...r.data, links: [] } };
}

export async function updateFamilyMember(accountId: string, id: string, input: unknown): Promise<FamilyResult> {
  const current = await familyMember(accountId, id);
  if (!current) return { ok: false, message: "Not found." };
  // Linked to a clinic: who they are is the clinic's record. Only who they are to you is yours to change.
  if (current.links.length > 0) {
    const relationship = (input as { relationship?: unknown })?.relationship;
    if (!FAMILY_RELATIONSHIPS.includes(relationship as (typeof FAMILY_RELATIONSHIPS)[number])) {
      return { ok: false, message: "Say who they are to you.", fieldErrors: { relationship: ["Required"] } };
    }
    await orm.FamilyMember.where((m) => m.id.eq(id)).update({ relationship, updatedAt: instantToDb(new Date()) } as never);
    return { ok: true, member: { ...current, relationship: relationship as FamilyMemberRow["relationship"] } };
  }
  const r = read(input);
  if (!r.ok) return r;
  await orm.FamilyMember.where((m) => m.id.eq(id)).update({ ...r.data, updatedAt: instantToDb(new Date()) } as never);
  return { ok: true, member: { id, ...r.data, links: [] } };
}

/** Off the list. Requests already sent for them stand; the clinic's chart, if any, is the clinic's. */
export async function removeFamilyMember(accountId: string, id: string): Promise<boolean> {
  const current = await familyMember(accountId, id);
  // Linked: stop looking after them first; the list follows the clinic.
  if (!current || current.links.length > 0) return false;
  await orm.FamilyMember.where((m) => m.id.eq(id)).delete();
  return true;
}
