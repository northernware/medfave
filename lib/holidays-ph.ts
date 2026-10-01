/*
 * Philippine regular holidays and special non-working days, for booking.
 *
 * Built in so a clinic is closed on them without anyone typing them in; a
 * doctor who works holidays turns it off (ScheduleSettings.observeHolidays).
 *
 * The dates follow the usual proclamation: fixed dates, Holy Week from Easter,
 * National Heroes Day on the last Monday of August, Chinese New Year from a
 * table. Malacañang proclaims the list each year and sometimes moves a day;
 * Eid'l Fitr and Eid'l Adha are set by proclamation and are not included —
 * add them as a day off when announced.
 */

export type Holiday = { date: string; name: string; kind: "regular" | "special" };

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Western Easter Sunday (anonymous Gregorian algorithm). */
function easter(y: number) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

const shift = (at: Date, days: number) => {
  const d = new Date(at.getTime() + days * 86_400_000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Last Monday of August. */
function heroesDay(y: number) {
  const last = new Date(Date.UTC(y, 7, 31));
  return shift(last, -((last.getUTCDay() + 6) % 7));
}

/** Chinese New Year, which moves with the lunar calendar. */
const CHINESE_NEW_YEAR: Record<number, string> = {
  2025: "2025-01-29",
  2026: "2026-02-17",
  2027: "2027-02-06",
  2028: "2028-01-26",
  2029: "2029-02-13",
  2030: "2030-02-03",
};

export function philippineHolidays(year: number): Holiday[] {
  const e = easter(year);
  const list: Holiday[] = [
    { date: iso(year, 1, 1), name: "New Year's Day", kind: "regular" },
    { date: shift(e, -3), name: "Maundy Thursday", kind: "regular" },
    { date: shift(e, -2), name: "Good Friday", kind: "regular" },
    { date: shift(e, -1), name: "Black Saturday", kind: "special" },
    { date: iso(year, 4, 9), name: "Araw ng Kagitingan", kind: "regular" },
    { date: iso(year, 5, 1), name: "Labor Day", kind: "regular" },
    { date: iso(year, 6, 12), name: "Independence Day", kind: "regular" },
    { date: iso(year, 8, 21), name: "Ninoy Aquino Day", kind: "special" },
    { date: heroesDay(year), name: "National Heroes Day", kind: "regular" },
    { date: iso(year, 11, 1), name: "All Saints' Day", kind: "special" },
    { date: iso(year, 11, 2), name: "All Souls' Day", kind: "special" },
    { date: iso(year, 11, 30), name: "Bonifacio Day", kind: "regular" },
    { date: iso(year, 12, 8), name: "Feast of the Immaculate Conception", kind: "special" },
    { date: iso(year, 12, 24), name: "Christmas Eve", kind: "special" },
    { date: iso(year, 12, 25), name: "Christmas Day", kind: "regular" },
    { date: iso(year, 12, 30), name: "Rizal Day", kind: "regular" },
    { date: iso(year, 12, 31), name: "Last Day of the Year", kind: "special" },
  ];
  const cny = CHINESE_NEW_YEAR[year];
  if (cny) list.push({ date: cny, name: "Chinese New Year", kind: "special" });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays from `fromKey` (YYYY-MM-DD) through the next `days` days. */
export function holidaysBetween(fromKey: string, days: number): Holiday[] {
  const start = Number(fromKey.slice(0, 4));
  const end = shift(new Date(`${fromKey}T00:00:00Z`), days);
  const out: Holiday[] = [];
  for (let y = start; y <= Number(end.slice(0, 4)); y++) out.push(...philippineHolidays(y));
  return out.filter((h) => h.date >= fromKey && h.date <= end);
}
