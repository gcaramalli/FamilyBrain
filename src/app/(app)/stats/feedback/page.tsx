"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { StatsHeader } from "@/components/page-header";
import { fmtDate } from "@/lib/dates";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback";

type Item = {
  id: string;
  kind: FeedbackKind;
  body: string;
  status: FeedbackStatus;
  created_at: string;
  author: string | null;
  email: string | null;
  family: string | null;
};

// Every family's ideas and bugs (hembrain_feedback(), 0020), to triage:
// the sender sees the status change on their Feedback page.
export default function FeedbackAdminPage() {
  const { supabase, superAdmin, t } = useFamily();
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("new");

  useEffect(() => {
    if (!superAdmin) return;
    supabase.rpc("hembrain_feedback").then(({ data }) => setItems((data ?? []) as Item[]));
  }, [supabase, superAdmin]);

  async function setStatus(id: string, status: FeedbackStatus) {
    setItems((xs) => xs?.map((x) => (x.id === id ? { ...x, status } : x)) ?? null);
    await supabase.from("feedback").update({ status }).eq("id", id);
  }

  if (!superAdmin) return <p className="text-muted">{t("Only Hembrain's owner can see this page.")}</p>;
  const shown = (items ?? []).filter((x) => filter === "all" || x.status === filter);
  const count = (s: FeedbackStatus) => (items ?? []).filter((x) => x.status === s).length;

  return (
    <div className="flex flex-col gap-4">
      <StatsHeader />
      <div className="flex flex-wrap gap-2">
        {[...FEEDBACK_STATUSES.map((s) => ({ id: s.id, label: `${t(s.id === "new" ? "New" : s.label)} (${count(s.id)})` })), { id: "all" as const, label: t("All") }].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`chip-toggle ${filter === f.id ? "chip-on" : ""}`}>
            {f.label}
          </button>
        ))}
      </div>
      {items === null && <p className="text-muted">{t("Loading…")}</p>}
      {items && shown.length === 0 && <p className="text-sm text-muted">{t("Nothing here.")}</p>}
      {shown.map((x) => (
        <article key={x.id} className="card flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
            <span className="min-w-0 truncate">
              {t(FEEDBACK_KINDS.find((k) => k.id === x.kind)?.label ?? "Other")} · {x.author ?? "?"} · {x.family ?? "?"}
            </span>
            <span className="shrink-0">{fmtDate(x.created_at, { day: "numeric", month: "short" })}</span>
          </div>
          <p className="whitespace-pre-wrap">{x.body}</p>
          <div className="flex items-center justify-between gap-3">
            {x.email ? <a className="break-all text-xs text-muted underline" href={`mailto:${x.email}`}>{x.email}</a> : <span />}
            <select className="input w-auto py-1 text-sm" value={x.status} onChange={(e) => setStatus(x.id, e.target.value as FeedbackStatus)}>
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{t(s.id === "new" ? "New" : s.label)}</option>
              ))}
            </select>
          </div>
        </article>
      ))}
    </div>
  );
}
