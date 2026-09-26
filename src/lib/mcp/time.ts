// Claude sends local Stockholm times ("2026-10-01T16:00"); the database
// stores UTC. These helpers convert both ways, DST included.

const TZ = "Europe/Stockholm";

function offsetMinutes(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - utcMs) / 60000);
}

// "2026-10-01T16:00" or "2026-10-01" (local Stockholm) → ISO UTC string.
// Strings that already carry a zone ("Z" or "+02:00") are kept as given.
export function stockholmToUtc(value: string) {
  const v = value.trim();
  if (/([zZ]|[+-]\d\d:?\d\d)$/.test(v)) {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
    return d.toISOString();
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) throw new Error(`Invalid date: ${value}. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM (Stockholm time).`);
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  let utc = guess - offsetMinutes(guess) * 60000;
  utc = guess - offsetMinutes(utc) * 60000; // second pass settles DST edges
  return new Date(utc).toISOString();
}

// ISO UTC → "2026-10-01 16:00" in Stockholm time.
export function utcToStockholm(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
