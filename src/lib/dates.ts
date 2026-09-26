// Small date helpers. Display uses the account's language and the phone's time zone.

let locale = "en-GB";
let labels = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };

// Called by FamilyProvider when the account's language is known.
export function setDateLocale(bcp47: string, words: typeof labels) {
  locale = bcp47;
  labels = words;
}
export const dateLocale = () => locale;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function formatDayHeading(d: Date) {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.tomorrow;
  if (diff === -1) return labels.yesterday;
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// Value for <input type="datetime-local"> in local time.
export function toLocalInput(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function daysUntil(dateStr: string) {
  const target = startOfDay(new Date(dateStr + "T00:00:00"));
  return Math.round((target.getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

// Date formatting in the account's language.
export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions) {
  return (typeof d === "string" ? new Date(d) : d).toLocaleDateString(locale, opts);
}
export function fmtDateTime(d: Date | string) {
  return (typeof d === "string" ? new Date(d) : d).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
