// Monthly cap on in-app Claude calls, per family (ai_budgets, 0020). Shared by
// the server (enforcement in src/lib/ai.ts) and the settings / stats pages.

// Families without an ai_budgets row are on the free plan at this cap.
export const FREE_MONTHLY_LIMIT_USD = 1;

export type AiPlan = "free" | "paid";

// Budgets reset on the 1st (UTC), same as date_trunc('month', now()) in SQL.
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const usd = (n: number) => `$${n.toFixed(n > 0 && n < 0.1 ? 3 : 2)}`;
