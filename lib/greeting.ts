import { CLINIC_TIME_ZONE } from "@/lib/datetime";

/**
 * "Good afternoon, Dr. Ana" for a doctor, "Good afternoon, Maria" for anyone
 * else: by the clinic's clock, first name only, the title kept for doctors.
 * The stored first name when there is one (so "Ma. Teresa" stays whole).
 */
export function greetingFor(fullName: string, doctor: boolean, now = new Date(), firstName?: string | null) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: CLINIC_TIME_ZONE }).format(now));
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = firstName || (fullName.replace(/^(Dr|Dra)\.?\s+/i, "").split(/\s+/)[0] ?? "");
  return `${part}, ${doctor ? `Dr. ${first}` : first}`;
}
