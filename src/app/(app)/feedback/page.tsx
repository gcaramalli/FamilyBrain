"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { fmtDate } from "@/lib/dates";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback";

type Mine = { id: string; kind: FeedbackKind; body: string; status: FeedbackStatus; created_at: string };

// Ideas and bugs go straight to Hembrain's owner (Hembrain admin → Feedback).
export default function FeedbackPage() {
  const { supabase, t } = useFamily();
  const toast = useToast();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [body, setBody] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => {
    supabase
      .from("feedback")
      .select("id, kind, body, status, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMine((data ?? []) as Mine[]));
  }, [supabase]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const { data, error } = await supabase.from("feedback").insert({ kind, body: body.trim() }).select("id, kind, body, status, created_at").single<Mine>();
    if (error || !data) return toast(t("Couldn't send it. Try again."));
    setMine((m) => [data, ...m]);
    setBody("");
    toast(t("Thanks! It's on its way."));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader module="feedback" back="/settings" backLabel={t("Settings")} title={t("Give feedback")} />
      <p className="text-sm text-muted">{t("What would make Hembrain better for your family? Every message is read.")}</p>

      <form onSubmit={send} className="card flex flex-col gap-3">
        <div className="grid grid-cols-3 rounded-full bg-accent-soft p-1 text-sm">
          {FEEDBACK_KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={`min-h-9 truncate rounded-full px-1 ${kind === k.id ? "bg-[var(--pill)] font-semibold shadow-sm" : "text-muted"}`}
            >
              {t(k.label)}
            </button>
          ))}
        </div>
        <textarea
          className="input min-h-32"
          maxLength={4000}
          placeholder={kind === "bug" ? t("What happened, and where?") : t("I'd love it if Hembrain could…")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="btn" disabled={!body.trim()}>{t("Send")}</button>
      </form>

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="h2">{t("What you sent")}</h2>
          <ul className="card flex flex-col divide-y divide-border p-0">
            {mine.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{t(FEEDBACK_KINDS.find((k) => k.id === f.kind)?.label ?? "Other")} · {fmtDate(f.created_at, { day: "numeric", month: "short" })}</span>
                  <span className="chip">{t(FEEDBACK_STATUSES.find((s) => s.id === f.status)?.label ?? "Sent")}</span>
                </div>
                <p className="whitespace-pre-wrap">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
