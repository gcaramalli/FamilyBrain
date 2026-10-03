import type { Expense } from "./types";

// Who owes whom. Each expense credits the payer with the amount and charges
// everyone it was for their share (equal, or by weight); a settlement is the same arithmetic
// (the payer gives, the one in split_among receives). Balances are in öre /
// cents to avoid rounding drift, per currency.

export type Transfer = { from: string; to: string; amount: number; currency: string };

type Row = Pick<Expense, "amount" | "currency" | "paid_by" | "split_among"> & { shares?: Expense["shares"] };

// Each person's part of an expense in cents: equal between split_among, or by
// the weights in `shares`. Largest remainders get the leftover cents, so the
// parts always add up to the total.
export function parts(total: number, splitAmong: string[], shares?: Record<string, number> | null) {
  const ids = shares ? Object.keys(shares).filter((id) => shares[id] > 0) : splitAmong;
  const w = ids.map((id) => (shares ? shares[id] : 1));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const exact = w.map((x) => (total * x) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  [...exact.keys()].sort((a, b) => exact[b] - out[b] - (exact[a] - out[a])).forEach((i) => {
    if (left-- > 0) out[i]++;
  });
  return new Map(ids.map((id, i) => [id, out[i]]));
}

export function balances(expenses: Row[]) {
  const out = new Map<string, Map<string, number>>(); // currency → member → cents (+ = is owed)
  for (const e of expenses) {
    const cur = out.get(e.currency) ?? new Map<string, number>();
    out.set(e.currency, cur);
    const total = Math.round(Number(e.amount) * 100);
    cur.set(e.paid_by, (cur.get(e.paid_by) ?? 0) + total);
    for (const [id, c] of parts(total, e.split_among, e.shares)) cur.set(id, (cur.get(id) ?? 0) - c);
  }
  return out;
}

// "50/50", "60/40": the weights as whole percentages, in the given order.
export function ratioLabel(shares: Record<string, number> | null | undefined, ids: string[]) {
  if (!shares || !ids.length) return ids.map(() => Math.round(100 / Math.max(ids.length, 1))).join("/");
  const sum = ids.reduce((a, id) => a + (shares[id] ?? 0), 0) || 1;
  return ids.map((id) => Math.round(((shares[id] ?? 0) * 100) / sum)).join("/");
}

// True when the weights split equally between everyone in ids.
export function isEqual(shares: Record<string, number> | null | undefined, ids: string[]) {
  if (!shares || !Object.keys(shares).length) return true;
  const w = ids.map((id) => shares[id] ?? 0);
  return w.every((x) => x === w[0]) && Object.keys(shares).every((id) => ids.includes(id));
}

// The fewest payments that square everyone up (greedy: biggest debtor pays
// biggest creditor). With two parents it is one line: "Jenny owes Guillaume".
export function settleUp(expenses: Row[]): Transfer[] {
  const transfers: Transfer[] = [];
  for (const [currency, byMember] of balances(expenses)) {
    const owed = [...byMember].filter(([, c]) => c > 0).map(([id, c]) => ({ id, c }));
    const owing = [...byMember].filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c }));
    owed.sort((a, b) => b.c - a.c);
    owing.sort((a, b) => b.c - a.c);
    let i = 0;
    let j = 0;
    while (i < owing.length && j < owed.length) {
      const c = Math.min(owing[i].c, owed[j].c);
      if (c > 0) transfers.push({ from: owing[i].id, to: owed[j].id, amount: c / 100, currency });
      owing[i].c -= c;
      owed[j].c -= c;
      if (owing[i].c === 0) i++;
      if (owed[j].c === 0) j++;
    }
  }
  return transfers;
}

export function fmtMoney(amount: number, currency: string, locale?: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}
