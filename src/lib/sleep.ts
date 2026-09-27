// Kid's sleep: naps and nights, summed per day. Shared by the Sleep tile
// (phone's time zone) and the Claude connector (Stockholm time), so the
// caller says which day a timestamp falls on.
import type { KidSleep } from "./types";

type Entry = Pick<KidSleep, "kind" | "starts_at" | "ends_at" | "wakings">;

export type SleepDay = {
  day: string; // YYYY-MM-DD
  night: { start: string; end: string | null; minutes: number; wakings: number } | null;
  naps: { start: string; end: string | null; minutes: number }[];
  nap_minutes: number;
  night_minutes: number;
};

export const minutesBetween = (a: string, b: string | Date) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

// "1 h 20", "45 min".
export function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

// A night belongs to the evening it started: shifting by 12 h puts a
// bedtime at 00:30 on the previous day, and one at 19:30 on its own day.
export const nightDay = (startsAt: string, dayOf: (iso: string) => string) =>
  dayOf(new Date(new Date(startsAt).getTime() - 12 * 3600000).toISOString());

// Days, newest first. An ongoing sleep counts up to `now`.
export function sleepDays(entries: Entry[], dayOf: (iso: string) => string, now = new Date()): SleepDay[] {
  const days = new Map<string, SleepDay>();
  const get = (day: string) => {
    if (!days.has(day)) days.set(day, { day, night: null, naps: [], nap_minutes: 0, night_minutes: 0 });
    return days.get(day)!;
  };
  for (const e of [...entries].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const minutes = minutesBetween(e.starts_at, e.ends_at ?? now);
    if (e.kind === "night") {
      const d = get(nightDay(e.starts_at, dayOf));
      // Two nights on one evening (put back to bed after a long waking): merge.
      d.night = d.night
        ? { ...d.night, end: e.ends_at, minutes: d.night.minutes + minutes, wakings: d.night.wakings + e.wakings + 1 }
        : { start: e.starts_at, end: e.ends_at, minutes, wakings: e.wakings };
      d.night_minutes += minutes;
    } else {
      const d = get(dayOf(e.starts_at));
      d.naps.push({ start: e.starts_at, end: e.ends_at, minutes });
      d.nap_minutes += minutes;
    }
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// Asleep right now (the latest entry has no end), or awake since when.
export function sleepState(entries: Entry[]) {
  const latest = [...entries].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (!latest) return null;
  if (!latest.ends_at) return { asleep: true as const, since: latest.starts_at, kind: latest.kind };
  const lastWake = entries.reduce((m, e) => (e.ends_at && e.ends_at > m ? e.ends_at : m), "");
  return { asleep: false as const, since: lastWake };
}

// Average minutes past midnight of a set of times, with evenings after
// midnight counted as late evenings (00:30 → 24:30).
export function avgClock(isos: string[], minutesOfDay: (iso: string) => number, evening = false) {
  if (!isos.length) return null;
  const vals = isos.map((i) => {
    const m = minutesOfDay(i);
    return evening && m < 12 * 60 ? m + 24 * 60 : m;
  });
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) % (24 * 60);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}
