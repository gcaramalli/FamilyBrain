import type { T } from "./i18n";
import type { Paper } from "./types";

// Papers: contracts, insurance, warranties and IDs, and the dates that matter
// in them. Shared by the app, the evening reminder and the connector.

export const PAPER_CATEGORIES = [
  { id: "insurance", label: "Insurance" },
  { id: "housing", label: "Housing" },
  { id: "energy", label: "Electricity & heating" },
  { id: "telecom", label: "Phone & internet" },
  { id: "loan", label: "Loans" },
  { id: "bank", label: "Bank & savings" },
  { id: "vehicle", label: "Car & transport" },
  { id: "subscription", label: "Subscriptions" },
  { id: "health", label: "Health" },
  { id: "work", label: "Work & pension" },
  { id: "tax", label: "Taxes" },
  { id: "identity", label: "IDs & passports" },
  { id: "warranty", label: "Receipts & warranties" },
  { id: "other", label: "Other" },
] as const;

export type PaperCategory = (typeof PAPER_CATEGORIES)[number]["id"];
export const PAPER_CATEGORY_IDS = PAPER_CATEGORIES.map((c) => c.id) as [PaperCategory, ...PaperCategory[]];

export const PERIODS = [
  { id: "month", label: "per month" },
  { id: "quarter", label: "per quarter" },
  { id: "year", label: "per year" },
  { id: "once", label: "once" },
] as const;
export const PERIOD_IDS = ["month", "quarter", "year", "once"] as const;

// Reminders go out this many days before a deadline (evening push).
export const REMIND_DAYS = [30, 7, 1];

// Dates are plain "YYYY-MM-DD" days: computed in UTC so the time zone never shifts them.
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);
export function plusDays(day: string, n: number) {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}
function plusMonths(day: string, n: number) {
  const d = parse(day);
  const date = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // 31 January + 1 month = 28/29 February, not 3 March.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(date, last));
  return toDay(d);
}

// The next renewal on or after today: a yearly contract whose stored date has
// passed renewed itself, so roll it forward by its period (a year when unknown).
export function nextRenewal(p: Pick<Paper, "renews_on" | "period">, today = todayKey()) {
  if (!p.renews_on) return null;
  if (p.period === "once") return p.renews_on >= today ? p.renews_on : null;
  const months = p.period === "month" ? 1 : p.period === "quarter" ? 3 : 12;
  let day = p.renews_on;
  for (let i = 0; day < today && i < 1200; i++) day = plusMonths(p.renews_on, months * (i + 1));
  return day;
}

export type DeadlineKind = "cancel" | "renew" | "expires" | "warranty";
export type Deadline = { paper: Paper; kind: DeadlineKind; date: string; days: number };

// What's coming for one paper. Monthly contracts get no cancel/renew dates:
// they can be cancelled any month, a reminder each month would be noise.
export function deadlines(p: Paper, today = todayKey()): Deadline[] {
  if (p.ended) return [];
  const out: Deadline[] = [];
  const add = (kind: DeadlineKind, date: string) => out.push({ paper: p, kind, date, days: daysBetween(today, date) });
  const renewal = p.period === "month" ? null : nextRenewal(p, today);
  if (renewal) {
    const cancelBy = p.notice_days != null ? plusDays(renewal, -p.notice_days) : null;
    if (cancelBy && cancelBy >= today) add("cancel", cancelBy);
    else add("renew", renewal);
  }
  if (p.expires_on && p.expires_on >= today) add("expires", p.expires_on);
  if (p.warranty_until && p.warranty_until >= today) add("warranty", p.warranty_until);
  return out;
}

export function upcomingDeadlines(papers: Paper[], withinDays: number, today = todayKey()) {
  return papers
    .flatMap((p) => deadlines(p, today))
    .filter((d) => d.days <= withinDays)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// "Home insurance: last day to cancel". Private papers can be named
// generically (lock screens, someone looking over a shoulder).
export function deadlineText(t: T, d: Deadline, title = d.paper.title) {
  if (d.kind === "cancel") return t("{title}: last day to cancel or renegotiate", { title });
  if (d.kind === "renew") return t("{title} renews", { title });
  if (d.kind === "expires") return t("{title} expires", { title });
  return t("{title}: end of warranty", { title });
}

// "in 7 days", "tomorrow", "today".
export function inDays(t: T, days: number) {
  return days <= 0 ? t("today") : days === 1 ? t("tomorrow") : t("in {n} days", { n: days });
}

// What it costs in a year, when it's a recurring cost.
export function yearlyCost(p: Pick<Paper, "amount" | "period">) {
  if (p.amount == null) return null;
  const n = p.period === "month" ? 12 : p.period === "quarter" ? 4 : p.period === "year" ? 1 : null;
  return n == null ? null : Math.round(Number(p.amount) * n * 100) / 100;
}

// Storage path of a paper's document: <family>/<paper>/<file name>.
export function paperFilePath(familyId: string, paperId: string, fileName: string) {
  const clean = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "document";
  return `${familyId}/${paperId}/${Date.now()}-${clean}`;
}
