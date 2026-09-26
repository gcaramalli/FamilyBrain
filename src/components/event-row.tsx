"use client";

import { useFamily } from "./family-context";
import { MemberBadge } from "./member-select";
import { formatTime } from "@/lib/dates";
import { occurrenceDays } from "@/lib/events";
import type { EventOccurrence } from "@/lib/types";

// Time column. On a multi-day event, `day` tells which of its days is shown.
function when(ev: EventOccurrence, day?: string) {
  const covered = occurrenceDays(ev);
  const i = day ? covered.indexOf(day) : 0;
  if (covered.length > 1 && i >= 0) {
    if (ev.all_day) return `Day ${i + 1}/${covered.length}`;
    if (i === covered.length - 1 && ev.occurrence_end) return `until ${formatTime(ev.occurrence_end)}`;
    if (i > 0) return "All day";
  }
  return ev.all_day ? "All day" : formatTime(ev.occurrence_start);
}

export function EventRow({ ev, day, onClick }: { ev: EventOccurrence; day?: string; onClick?: () => void }) {
  const { addedBy } = useFamily();
  const by = addedBy(ev.created_by);
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 py-2 text-left">
      <div className="w-14 shrink-0 pt-0.5 text-sm text-muted">{when(ev, day)}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {ev.title}
          {ev.recurrence && <span className="ml-1 text-xs text-muted" title="Repeats">🔁</span>}
        </div>
        {ev.location && <div className="truncate text-sm text-muted">📍 {ev.location}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <MemberBadge id={ev.responsible_member_id} />
          {ev.for_member_id && ev.for_member_id !== ev.responsible_member_id && (
            <span className="text-xs text-muted">for</span>
          )}
          {ev.for_member_id !== ev.responsible_member_id && <MemberBadge id={ev.for_member_id} />}
          {by && <span className="text-xs text-muted">· added by {by}</span>}
        </div>
      </div>
    </button>
  );
}
