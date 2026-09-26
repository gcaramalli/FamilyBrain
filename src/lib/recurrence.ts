// Simple repeating events. Works on calendar dates ("YYYY-MM-DD") so it is
// independent of time zones; callers add the local time of day.

export const RECURRENCES = [
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Every weekday (Mon–Fri)" },
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
] as const;

export type Recurrence = (typeof RECURRENCES)[number]["id"];

const toUtc = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86400000;

// Dates of a series that fall within [from, to] (inclusive), capped for safety.
export function occurrenceDates(start: string, rule: Recurrence | null, until: string | null, from: string, to: string, max = 400) {
  if (!rule) return start >= from && start <= to ? [start] : [];
  const out: string[] = [];
  const end = until && until < to ? until : to;
  const s = toUtc(start);
  const startDay = new Date(s).getUTCDate();

  if (rule === "monthly") {
    const sd = new Date(s);
    for (let i = 0; out.length < max; i++) {
      const y = sd.getUTCFullYear();
      const m = sd.getUTCMonth() + i;
      const d = new Date(Date.UTC(y, m, startDay));
      if (d.getUTCMonth() !== ((m % 12) + 12) % 12) continue; // e.g. no 31st this month
      const ymd = toYmd(d.getTime());
      if (ymd > end) break;
      if (ymd >= from) out.push(ymd);
    }
    return out;
  }

  const step = rule === "weekly" ? 7 : rule === "biweekly" ? 14 : 1;
  // Jump close to the window instead of walking from the start.
  let t = s;
  const f = toUtc(from);
  if (f > s) t = s + Math.floor((f - s) / (step * DAY)) * step * DAY;
  for (; toYmd(t) <= end && out.length < max; t += step * DAY) {
    const ymd = toYmd(t);
    if (ymd < from || ymd < start) continue;
    if (rule === "weekdays") {
      const dow = new Date(t).getUTCDay();
      if (dow === 0 || dow === 6) continue;
    }
    out.push(ymd);
  }
  return out;
}
