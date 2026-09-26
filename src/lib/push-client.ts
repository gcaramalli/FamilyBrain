"use client";

import type { Member } from "./types";

// Tell the other parent they were given something to do (best effort).
export function notifyAssignment(to: Member | undefined, me: Member | undefined, ev: { title: string; starts_at: string; all_day: boolean }) {
  if (!to?.profile_id || to.id === me?.id) return;
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ member_id: to.id, title: ev.title, starts_at: ev.starts_at, all_day: ev.all_day }),
  }).catch(() => {});
}
