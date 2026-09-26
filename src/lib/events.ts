import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey } from "./dates";
import { occurrenceDates } from "./recurrence";
import type { CalendarEvent, EventOccurrence } from "./types";

// Events overlapping [from, to), with repeating events expanded into their
// occurrences (in the phone's local time).
export async function fetchOccurrences(supabase: SupabaseClient, from: Date, to: Date): Promise<EventOccurrence[]> {
  const fromIso = from.toISOString();
  const fromDate = dayKey(from);
  const { data } = await supabase
    .from("events")
    .select("*")
    .lt("starts_at", to.toISOString())
    .or(`and(recurrence.is.null,starts_at.gte.${fromIso}),and(recurrence.not.is.null,or(recurrence_until.is.null,recurrence_until.gte.${fromDate}))`)
    .order("starts_at");
  return expand((data ?? []) as CalendarEvent[], from, to);
}

export function expand(events: CalendarEvent[], from: Date, to: Date): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  const lastDay = dayKey(new Date(to.getTime() - 1));
  for (const ev of events) {
    const base = new Date(ev.starts_at);
    const duration = ev.ends_at ? new Date(ev.ends_at).getTime() - base.getTime() : null;
    for (const d of occurrenceDates(dayKey(base), ev.recurrence, ev.recurrence_until, dayKey(from), lastDay)) {
      const [y, m, day] = d.split("-").map(Number);
      const start = new Date(base);
      start.setFullYear(y, m - 1, day);
      if (start < from || start >= to) continue;
      out.push({
        ...ev,
        key: `${ev.id}:${d}`,
        occurrence_start: start.toISOString(),
        occurrence_end: duration !== null ? new Date(start.getTime() + duration).toISOString() : null,
      });
    }
  }
  return out.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start));
}
