"use client";

import { useEffect, useRef, useState } from "react";
import { useFamily } from "./family-context";
import { assignSlot, findSlot, usualTime, type CareKind } from "@/lib/care";
import { fetchOccurrences } from "@/lib/events";
import { formatTime } from "@/lib/dates";
import { notifyAssignment } from "@/lib/push-client";
import type { EventOccurrence, Member } from "@/lib/types";

// One drop-off or pick-up. Tapping cycles me → the other parent → nobody.
export function CareSlot({
  kid,
  day,
  kind,
  event,
  past,
  onChanged,
  onEdit,
}: {
  kid: Member;
  day: string;
  kind: CareKind;
  event: EventOccurrence | null;
  past?: boolean;
  onChanged: () => void;
  onEdit?: (ev: EventOccurrence) => void;
}) {
  const { supabase, adults, me, memberById, t } = useFamily();
  const [shown, setShown] = useState<string | null | undefined>(undefined); // optimistic value
  const [error, setError] = useState(false);
  const notifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef(Promise.resolve());

  const current = shown !== undefined ? shown : event?.responsible_member_id ?? null;
  const person = memberById(current);
  const order = [...(me ? [me.id] : []), ...adults.filter((a) => a.id !== me?.id).map((a) => a.id), null];

  // The server state caught up: drop the optimistic value.
  useEffect(() => setShown(undefined), [event?.key, event?.responsible_member_id]);
  useEffect(() => () => {
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
  }, []);

  function tap() {
    const next = order[(order.indexOf(current) + 1) % order.length];
    setShown(next);
    setError(false);
    // Taps are applied one after the other, each against the latest state.
    queue.current = queue.current.then(async () => {
      // Re-read the slot: an earlier tap may have just created or changed it.
      const start = new Date(`${day}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const latest = findSlot(await fetchOccurrences(supabase, start, end), kid, day, kind);
      const err = await assignSlot(supabase, kid, day, kind, next, latest);
      if (err) setError(true);
      onChanged();
    });
    // Only tell the other parent once the tapping has settled.
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => {
      const who = memberById(next);
      if (who) notifyAssignment(who, me, { title: `${kind === "dropoff" ? "Drop-off" : "Pick-up"} ${kid.name}`, starts_at: new Date(`${day}T${usualTime(kid, kind)}:00`).toISOString(), all_day: false });
    }, 4000);
  }

  const time = event ? formatTime(event.occurrence_start) : usualTime(kid, kind);
  return (
    <div className={`relative ${past ? "opacity-50" : ""}`}>
      <button
        onClick={tap}
        aria-label={`${kind === "dropoff" ? t("Drop-off") : t("Pick-up")} ${time}: ${person ? person.name : t("nobody yet")}. ${t("Tap to change")}`}
        className={`flex min-h-14 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
          person ? "border-transparent" : "border-dashed border-border"
        } ${error ? "border-danger" : ""}`}
        style={person ? { background: `color-mix(in srgb, ${person.color} 14%, transparent)` } : undefined}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${person ? "text-white" : "border border-dashed border-muted text-muted"}`}
          style={person ? { background: person.color } : undefined}
        >
          {person ? person.name.slice(0, 1) : "?"}
        </span>
        <span className="min-w-0">
          <span className="block text-xs tabular-nums text-muted">
            {kind === "dropoff" ? "☀️" : "🌙"} {time}
          </span>
          <span className={`block truncate text-sm font-medium ${person ? "" : "text-muted"}`}>{person ? person.name : t("Who?")}</span>
        </span>
      </button>
      {event && onEdit && (
        <button onClick={() => onEdit(event)} aria-label={t("Edit time or place")} className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted">
          ⋯
        </button>
      )}
    </div>
  );
}
