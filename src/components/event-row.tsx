"use client";

import { MemberBadge } from "./member-select";
import { formatTime } from "@/lib/dates";
import type { CalendarEvent } from "@/lib/types";

export function EventRow({ ev, onClick }: { ev: CalendarEvent; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 py-2 text-left">
      <div className="w-14 shrink-0 pt-0.5 text-sm text-muted">{ev.all_day ? "All day" : formatTime(ev.starts_at)}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{ev.title}</div>
        {ev.location && <div className="truncate text-sm text-muted">📍 {ev.location}</div>}
        <div className="mt-1 flex flex-wrap gap-1">
          <MemberBadge id={ev.responsible_member_id} />
          {ev.for_member_id && ev.for_member_id !== ev.responsible_member_id && (
            <span className="text-xs text-muted">for</span>
          )}
          {ev.for_member_id !== ev.responsible_member_id && <MemberBadge id={ev.for_member_id} />}
        </div>
      </div>
    </button>
  );
}
