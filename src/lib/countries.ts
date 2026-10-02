// Countries the family has been to (table visited_countries). Stored as ISO
// 3166-1 alpha-2 codes; names come from the browser/Node (Intl.DisplayNames),
// so they are in every app language for free. Kosovo uses the common "XK".

import world from "./world-map.json";

export const COUNTRY_CODES = [...new Set([...Object.keys(world.shapes), ...Object.keys(world.dots)])];

export const REGIONS = ["world", "europe", "americas", "asia", "africa", "oceania"] as const;
export type Region = (typeof REGIONS)[number];

// Short names where the long one is a mouthful ("R.A.S. chinoise de Hong Kong"),
// but not where it turns into initials ("R.-U.").
const SHORT = new Set(["HK", "MO", "PS"]);
const displayNames = new Map<string, Intl.DisplayNames>();
export function countryName(code: string, locale = "en") {
  if (code === "XK") return "Kosovo";
  const style = SHORT.has(code) ? "short" : "long";
  let dn = displayNames.get(locale + style);
  if (!dn) displayNames.set(locale + style, (dn = new Intl.DisplayNames([locale], { type: "region", style, fallback: "code" })));
  return dn.of(code) ?? code;
}

// Flag emoji from the two letters.
export const flag = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Names that Intl does not give in en/fr/sv: UK nations, old and short names.
const ALIASES: Record<string, string> = {
  england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB", "great britain": "GB", uk: "GB", angleterre: "GB",
  ecosse: "GB", "pays de galles": "GB", "irlande du nord": "GB", "grande bretagne": "GB", skottland: "GB",
  nordirland: "GB", storbritannien: "GB", usa: "US", us: "US", america: "US", amerique: "US", "chine continentale": "CN",
  "mainland china": "CN", "fastlandskina": "CN", vatican: "VA", vatikanen: "VA", "czech republic": "CZ", "republique tcheque": "CZ",
  holland: "NL", hollande: "NL", turkey: "TR", turquie: "TR", turkiet: "TR", macau: "MO", burma: "MM", swaziland: "SZ",
  "ivory coast": "CI", macedonia: "MK", "south korea": "KR", "north korea": "KP", russia: "RU", uae: "AE", emirates: "AE",
};

let index: Map<string, string> | undefined;
function nameIndex() {
  if (index) return index;
  index = new Map(Object.entries(ALIASES));
  for (const code of COUNTRY_CODES) for (const l of ["en", "fr", "sv"]) index.set(norm(countryName(code, l)), code);
  return index;
}

// One country from what someone typed: a code ("SE"), a name in en/fr/sv, or
// part of one ("Macao" for "R.A.S. chinoise de Macao").
export function findCountry(input: string): string | undefined {
  const raw = input.trim();
  if (/^[A-Za-z]{2}$/.test(raw) && COUNTRY_CODES.includes(raw.toUpperCase())) return raw.toUpperCase();
  const n = norm(raw);
  if (!n) return undefined;
  const idx = nameIndex();
  if (idx.has(n)) return idx.get(n);
  if (n.length < 4) return undefined;
  const hits = new Set([...idx].filter(([name]) => name.includes(n) || (n.includes(name) && name.length >= 4)).map(([, c]) => c));
  return hits.size === 1 ? [...hits][0] : undefined;
}

// A pasted list (one per line or comma-separated) → codes, plus what wasn't understood.
export function parseCountries(text: string) {
  const codes: string[] = [];
  const unknown: string[] = [];
  for (const part of text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const c = findCountry(part);
    if (!c) unknown.push(part);
    else if (!codes.includes(c)) codes.push(c);
  }
  return { codes, unknown };
}

// country → ids of the members who have been there.
export function whoWent(rows: { country: string; member_id: string }[]) {
  const who = new Map<string, string[]>();
  for (const r of rows) who.set(r.country, [...(who.get(r.country) ?? []), r.member_id]);
  return who;
}

// "Jul 2024", "Jul – Aug 2024", "Aug 2010 – May 2011", "since Sep 2013".
export function tripWhen(trip: { start_month: string | null; end_month: string | null; lived: boolean }, locale: string, t: (k: string, v?: Record<string, string>) => string) {
  if (!trip.start_month) return "";
  const at = (s: string, year = true) => new Date(`${s}T12:00:00`).toLocaleDateString(locale, year ? { month: "short", year: "numeric" } : { month: "short" });
  const start = trip.start_month;
  const end = trip.end_month;
  if (!end) return trip.lived ? t("since {when}", { when: at(start) }) : at(start);
  if (end === start) return at(start);
  return start.slice(0, 4) === end.slice(0, 4) ? `${at(start, false)} – ${at(end)}` : `${at(start)} – ${at(end)}`;
}
