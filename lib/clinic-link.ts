import "server-only";
import { orm } from "@/src/prisma/db";

/** A link name from a clinic's name: "Santos Family Clinic" → "santos-family-clinic". */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "clinic";
}

/** The clinic's link name, making one (unique) the first time it's needed. */
export async function ensureSlug(clinicId: string): Promise<string> {
  const clinic = await orm.Clinic.select("name", "slug").where((c) => c.id.eq(clinicId)).first();
  if (!clinic) throw new Error("No clinic");
  if (clinic.slug) return clinic.slug;
  const base = slugify(clinic.name);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await orm.Clinic.select("id").where((c) => c.slug.eq(candidate)).first();
    if (!taken) {
      await orm.Clinic.where((c) => c.id.eq(clinicId)).update({ slug: candidate });
      return candidate;
    }
  }
}
