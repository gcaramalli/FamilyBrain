"use client";

import { useEffect, useState } from "react";
import { FREE_MONTHLY_LIMIT_USD, monthStart, usd, type AiPlan } from "@/lib/ai-budget";
import { useFamily } from "./family-context";

// How much of the family's monthly AI budget is left (receipt scan, "type
// it"). The cap is set by Hembrain's owner; Claude through the connector
// runs on the family's own Claude account and does not count.
export function AiBudget() {
  const { supabase, family, ai, t } = useFamily();
  const [state, setState] = useState<{ plan: AiPlan; limit: number; spent: number } | null>(null);

  useEffect(() => {
    if (!ai) return;
    Promise.all([
      supabase.from("ai_budgets").select("plan, monthly_limit_usd").eq("family_id", family.id).maybeSingle(),
      supabase.from("ai_usage").select("cost_usd").gte("created_at", monthStart().toISOString()),
    ]).then(([{ data: b }, { data: rows }]) =>
      setState({
        plan: (b?.plan as AiPlan) ?? "free",
        limit: b ? Number(b.monthly_limit_usd) : FREE_MONTHLY_LIMIT_USD,
        spent: (rows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0),
      }),
    );
  }, [supabase, family.id, ai]);

  if (!ai || !state) return null;
  const share = state.limit > 0 ? Math.min(1, state.spent / state.limit) : 1;
  return (
    <section className="card flex flex-col gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">{t("AI in the app")}</h2>
        <span className="chip">{state.plan === "paid" ? t("Paid plan") : t("Free plan")}</span>
      </div>
      <p className="text-muted">{t("Receipt scans and events typed in plain words, for the whole family.")}</p>
      <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${share * 100}%` }} />
      </div>
      <p>
        {share >= 1
          ? t("Used up this month. It resets on the 1st.")
          : t("{percent}% used this month", { percent: Math.round(share * 100) })}
        <span className="text-muted"> · {usd(state.spent)} / {usd(state.limit)}</span>
      </p>
    </section>
  );
}
