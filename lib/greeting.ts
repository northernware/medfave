import { CLINIC_TIME_ZONE } from "@/lib/datetime";

/**
 * "Good afternoon, Dr. Ana" for a doctor, "Good afternoon, Maria" for anyone
 * else: by the clinic's clock, first name only, the title kept for doctors.
 */
export function greetingFor(fullName: string, doctor: boolean, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: CLINIC_TIME_ZONE }).format(now));
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = fullName.replace(/^(Dr|Dra)\.?\s+/i, "").split(/\s+/)[0] ?? "";
  return `${part}, ${doctor ? `Dr. ${first}` : first}`;
}
