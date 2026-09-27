"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/components/family-context";
import { StatsHeader } from "@/components/page-header";
import { FREE_MONTHLY_LIMIT_USD, usd, type AiPlan } from "@/lib/ai-budget";
import { fmtDateTime } from "@/lib/dates";

type Row = {
  id: string;
  name: string;
  plan: AiPlan;
  limit_usd: number;
  month_usd: number;
  month_calls: number;
  last_month_usd: number;
  last_call: string | null;
};

// What each family's in-app Claude calls cost this month (hembrain_ai_usage(),
// 0020), and their plan and cap. Only super admins can change a cap.
export default function AiBudgetAdminPage() {
  const { supabase, superAdmin, ai, t } = useFamily();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!superAdmin) return;
    supabase.rpc("hembrain_ai_usage").then(({ data }) =>
      setRows(((data ?? []) as Row[]).map((r) => ({ ...r, limit_usd: Number(r.limit_usd), month_usd: Number(r.month_usd), last_month_usd: Number(r.last_month_usd) }))),
    );
  }, [supabase, superAdmin]);

  if (!superAdmin) return <p className="text-muted">{t("Only Hembrain's owner can see this page.")}</p>;
  const total = (rows ?? []).reduce((s, r) => s + r.month_usd, 0);
  const calls = (rows ?? []).reduce((s, r) => s + r.month_calls, 0);

  return (
    <div className="flex flex-col gap-4">
      <StatsHeader />
      {!ai && <p className="card text-sm text-muted">{t("No Anthropic API key on the server: in-app AI is off for everyone.")}</p>}
      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-2xl font-semibold tabular-nums">{usd(total)}</div>
          <div className="text-sm text-muted">{t("Spent this month")}</div>
        </div>
        <div className="card">
          <div className="text-2xl font-semibold tabular-nums">{calls}</div>
          <div className="text-sm text-muted">{t("AI calls this month")}</div>
        </div>
      </section>
      <p className="text-sm text-muted">
        {t("Free plan: {limit} a month per family. Claude through the connector runs on the family's own Claude account and costs nothing here.", { limit: usd(FREE_MONTHLY_LIMIT_USD) })}
      </p>
      {rows === null && <p className="text-muted">{t("Loading…")}</p>}
      {rows?.map((r) => <FamilyBudget key={r.id} row={r} />)}
    </div>
  );
}

function FamilyBudget({ row }: { row: Row }) {
  const { supabase, t } = useFamily();
  const [plan, setPlan] = useState<AiPlan>(row.plan);
  const [limit, setLimit] = useState(String(row.limit_usd));
  const [saved, setSaved] = useState(false);
  // What is stored, so the button knows when there is something to save.
  const [stored, setStored] = useState({ plan: row.plan, limit: row.limit_usd });
  const share = stored.limit > 0 ? Math.min(1, row.month_usd / stored.limit) : 1;
  const dirty = plan !== stored.plan || Number(limit) !== stored.limit;

  async function save() {
    const value = Math.max(0, Number(limit) || 0);
    await supabase.from("ai_budgets").upsert({ family_id: row.id, plan, monthly_limit_usd: value, updated_at: new Date().toISOString() });
    setStored({ plan, limit: value });
    setLimit(String(value));
    setSaved(true);
  }

  return (
    <article className="card flex flex-col gap-2 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{row.name}</h3>
        <span className="tabular-nums">{usd(row.month_usd)} / {usd(stored.limit)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
        <div className={`h-full rounded-full ${share >= 1 ? "bg-danger" : "bg-foreground"}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-xs text-muted">
        {t("{calls} calls this month · {last} last month", { calls: row.month_calls, last: usd(row.last_month_usd) })}
        {row.last_call && <> · {t("last {date}", { date: fmtDateTime(row.last_call) })}</>}
      </p>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="label">{t("Plan")}</span>
          <select
            className="input"
            value={plan}
            onChange={(e) => {
              const p = e.target.value as AiPlan;
              setPlan(p);
              if (p === "free") setLimit(String(FREE_MONTHLY_LIMIT_USD));
              setSaved(false);
            }}
          >
            <option value="free">{t("Free")}</option>
            <option value="paid">{t("Paid")}</option>
          </select>
        </label>
        <label className="w-28">
          <span className="label">{t("$ / month")}</span>
          <input className="input" type="number" min={0} step={0.5} value={limit} onChange={(e) => { setLimit(e.target.value); setSaved(false); }} />
        </label>
        <button className="btn" disabled={!dirty && !saved} onClick={save}>{saved && !dirty ? "✓" : t("Save")}</button>
      </div>
    </article>
  );
}
