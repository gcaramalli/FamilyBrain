import type { Expense } from "./types";

// Who owes whom. Each expense credits the payer with the amount and charges
// everyone it was for an equal share; a settlement is the same arithmetic
// (the payer gives, the one in split_among receives). Balances are in öre /
// cents to avoid rounding drift, per currency.

export type Transfer = { from: string; to: string; amount: number; currency: string };

export function balances(expenses: Pick<Expense, "amount" | "currency" | "paid_by" | "split_among">[]) {
  const out = new Map<string, Map<string, number>>(); // currency → member → cents (+ = is owed)
  for (const e of expenses) {
    const cur = out.get(e.currency) ?? new Map<string, number>();
    out.set(e.currency, cur);
    const total = Math.round(Number(e.amount) * 100);
    const n = e.split_among.length;
    cur.set(e.paid_by, (cur.get(e.paid_by) ?? 0) + total);
    e.split_among.forEach((id, i) => {
      // The first ones absorb the leftover cents, so shares always add up.
      const share = Math.floor(total / n) + (i < total % n ? 1 : 0);
      cur.set(id, (cur.get(id) ?? 0) - share);
    });
  }
  return out;
}

// The fewest payments that square everyone up (greedy: biggest debtor pays
// biggest creditor). With two parents it is one line: "Jenny owes Guillaume".
export function settleUp(expenses: Pick<Expense, "amount" | "currency" | "paid_by" | "split_among">[]): Transfer[] {
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
