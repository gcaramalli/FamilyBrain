// Dates celebrated every year (weddings, birthdays). Pure date maths on
// "YYYY-MM-DD" strings, in the phone's local calendar.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, dayKey, startOfDay } from "./dates";
import { fetchOccurrences } from "./events";
import type { T } from "./i18n";
import type { EventOccurrence, Member, Occasion } from "./types";

// "2 years married", "turns 3"…
export function occasionLabel(t: T, kind: Occasion["kind"], years: number) {
  if (kind === "wedding") return years === 1 ? t("1 year married") : t("{n} years married", { n: years });
  if (kind === "birthday") return t("turns {n}", { n: years });
  return years === 1 ? t("1 year") : t("{n} years", { n: years });
}

export const OCCASION_EMOJI: Record<Occasion["kind"], string> = { wedding: "💍", birthday: "🎂", other: "✨" };

// The next time `date` comes round on or after `from`. 29 February falls on
// 28 February in other years.
export function nextAnniversary(date: string, from: Date = new Date()) {
  const [y, m, d] = date.split("-").map(Number);
  const start = startOfDay(from);
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    const day = new Date(year, m - 1, d);
    if (day.getMonth() !== m - 1) day.setDate(0);
    if (day >= start) return { day, years: year - y };
  }
  return { day: new Date(start.getFullYear() + 1, m - 1, d), years: start.getFullYear() + 1 - y };
}

export const daysAway = (day: Date, from: Date = new Date()) =>
  Math.round((startOfDay(day).getTime() - startOfDay(from).getTime()) / 86400000);

// Occasions still celebrated whose anniversary falls within `days` from today, soonest first.
export function upcoming(occasions: Occasion[], days: number, from: Date = new Date()) {
  return occasions
    .filter((o) => !o.ended)
    .map((o) => ({ o, ...nextAnniversary(o.date, from) }))
    .filter((x) => daysAway(x.day, from) <= days && x.years >= 0)
    .sort((a, b) => a.day.getTime() - b.day.getTime());
}

// Our own dates (our wedding, the family's birthdays) as read-only all-day
// calendar entries between `from` and `to`. Friends' occasions never go here.
export function familyDates(occasions: Occasion[], members: Member[], from: Date, to: Date, t: T): EventOccurrence[] {
  const sources = [
    ...occasions.filter((o) => o.ours && !o.ended).map((o) => ({ id: o.id, kind: o.kind, title: o.title, date: o.date })),
    ...members.filter((m) => m.birthdate).map((m) => ({ id: `bday-${m.id}`, kind: "birthday" as const, title: m.name, date: m.birthdate! })),
  ];
  const out: EventOccurrence[] = [];
  for (const s of sources) {
    for (let cursor = startOfDay(from); cursor < to; ) {
      const { day, years } = nextAnniversary(s.date, cursor);
      if (day >= to) break;
      if (years >= 0) {
        const start = startOfDay(day);
        out.push({
          id: `date:${s.id}`,
          key: `date:${s.id}:${dayKey(start)}`,
          title: s.kind === "birthday" ? `${s.title} ${occasionLabel(t, s.kind, years)}` : `${s.title} · ${occasionLabel(t, s.kind, years)}`,
          starts_at: start.toISOString(),
          ends_at: null,
          all_day: true,
          location: null,
          notes: null,
          responsible_member_id: null,
          for_member_id: null,
          recurrence: null,
          recurrence_until: null,
          occurrence_start: start.toISOString(),
          occurrence_end: null,
          badge: OCCASION_EMOJI[s.kind],
          link: "/brain?tab=dates",
        });
      }
      cursor = addDays(day, 1);
    }
  }
  return out;
}

export async function fetchOccasions(supabase: SupabaseClient, familyId?: string): Promise<Occasion[]> {
  let q = supabase.from("occasions").select("id, kind, title, date, ours, member_ids, ended, notes");
  if (familyId) q = q.eq("family_id", familyId);
  const { data } = await q.order("date", { ascending: false });
  return (data ?? []) as Occasion[];
}

// "YYMMDD Title", "YYYY-MM-DD Title" or "DD/MM/YYYY Title", one per line.
// A trailing "*" means only I was there; "//" means no longer celebrated.
export type ParsedOccasion = { date: string; title: string; alone: boolean; ended: boolean };
export function parseOccasionList(text: string): { ok: ParsedOccasion[]; bad: string[] } {
  const ok: ParsedOccasion[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    const ended = line.includes("//");
    line = line.replace(/\/\//g, " ");
    const alone = /\*/.test(line);
    line = line.replace(/\*/g, " ").trim();
    let m = line.match(/^(\d{2})(\d{2})(\d{2})\s+(.+)$/);
    let date: string | null = null;
    let title = "";
    if (m) {
      date = `20${m[1]}-${m[2]}-${m[3]}`;
      title = m[4];
    } else if ((m = line.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/))) {
      date = `${m[1]}-${m[2]}-${m[3]}`;
      title = m[4];
    } else if ((m = line.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})\s+(.+)$/))) {
      date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      title = m[4];
    }
    const d = date ? new Date(`${date}T12:00:00`) : null;
    if (!date || !d || isNaN(d.getTime()) || dayKey(d) !== date || !title.trim()) {
      bad.push(raw.trim());
      continue;
    }
    ok.push({ date, title: title.replace(/\s+/g, " ").trim(), alone, ended });
  }
  return { ok, bad };
}

// Calendar events plus our own dates, for the calendar and Today screens.
export async function fetchCalendar(supabase: SupabaseClient, members: Member[], from: Date, to: Date, t: T) {
  const [events, occasions] = await Promise.all([fetchOccurrences(supabase, from, to), fetchOccasions(supabase)]);
  return [...events, ...familyDates(occasions, members, from, to, t)].sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start));
}
