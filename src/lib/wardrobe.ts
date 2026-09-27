// Kid's wardrobe: categories and the essentials worth having for the season
// (Swedish preschool: rain gear and overalls matter more than fashion).
// Labels are English and translated on display with t(label).

export const CLOTHES_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "base", label: "Bodysuits, underwear, socks", emoji: "🧦" },
  { id: "sleep", label: "Pyjamas, sleeping bag", emoji: "🌙" },
  { id: "tops", label: "Tops, sweaters", emoji: "👕" },
  { id: "bottoms", label: "Trousers, leggings", emoji: "👖" },
  { id: "outerwear", label: "Jackets, overalls", emoji: "🧥" },
  { id: "rain", label: "Rain gear", emoji: "☔" },
  { id: "shoes", label: "Shoes, boots", emoji: "👟" },
  { id: "accessories", label: "Hats, mittens, scarves", emoji: "🧢" },
  { id: "other", label: "Other", emoji: "🎒" },
];
export const CLOTHES_CATEGORY_IDS = CLOTHES_CATEGORIES.map((c) => c.id) as [string, ...string[]];

export const CLOTHES_STATUSES = [
  { id: "have", label: "Has" },
  { id: "need", label: "To buy" },
  { id: "outgrown", label: "Too small" },
] as const;

type Essential = { title: string; category: string; season: "cold" | "warm" | "all"; words: string[] };

// Covered as soon as an item (has or to buy) mentions one of `words`, in any
// of the app's languages.
export const ESSENTIALS: Essential[] = [
  { title: "Rain jacket and trousers", category: "rain", season: "all", words: ["rain jacket", "rain trousers", "rain pants", "raincoat", "rain suit", "imperméable", "ciré", "pantalon de pluie", "regnkläder", "regnjacka", "regnbyxor", "regnställ"] },
  { title: "Rubber boots", category: "shoes", season: "all", words: ["rubber", "welly", "wellington", "caoutchouc", "bottes de pluie", "gummistövl"] },
  { title: "Spare clothes for preschool", category: "other", season: "all", words: ["spare", "rechange", "extra", "ombyte"] },
  { title: "Winter overall", category: "outerwear", season: "cold", words: ["overall", "combinaison", "combi"] },
  { title: "Warm hat", category: "accessories", season: "cold", words: ["warm hat", "beanie", "winter hat", "bonnet", "mössa"] },
  { title: "Mittens", category: "accessories", season: "cold", words: ["mitten", "moufle", "gant", "vant"] },
  { title: "Wool base layer", category: "base", season: "cold", words: ["wool", "merino", "mérinos", "laine", "ullunder", "ullbody", "ulltröja"] },
  { title: "Winter boots", category: "shoes", season: "cold", words: ["winter boot", "bottes d'hiver", "vinterk", "vinterstövl"] },
  { title: "Sun hat", category: "accessories", season: "warm", words: ["sun hat", "chapeau", "bob", "solhatt", "keps", "casquette"] },
  { title: "Sandals", category: "shoes", season: "warm", words: ["sandal"] },
];

// October–April counts as the cold season in Sweden.
export const coldSeason = (d = new Date()) => d.getMonth() >= 9 || d.getMonth() <= 3;

// Essentials of the season that nothing in the wardrobe mentions yet.
// `translate` gives the title in the account's language, so a suggestion added
// from the app also counts once it's in.
export function missingEssentials(items: { title: string; status: string }[], translate: (s: string) => string, d = new Date()) {
  const season = coldSeason(d) ? "cold" : "warm";
  const titles = items.filter((i) => i.status !== "outgrown").map((i) => i.title.toLowerCase());
  return ESSENTIALS.filter((e) => e.season === "all" || e.season === season).filter((e) => {
    const words = [...e.words, translate(e.title).toLowerCase()];
    return !titles.some((title) => words.some((w) => title.includes(w)));
  });
}

// Oldest age (months) a Nordic centimetre size usually fits: 74 ≈ 6–9 months,
// 86 ≈ 12–18 months, 92 ≈ 18–24 months…
const CM_UNTIL_MONTHS: [number, number][] = [[50, 1], [56, 2], [62, 4], [68, 6], [74, 9], [80, 12], [86, 18], [92, 24], [98, 36], [104, 48], [110, 60], [116, 72], [122, 84], [128, 96]];

// Upper age in months written in a size: "6-9 mois", "12M", "6–9 mån", "2 ans", "3Y".
function sizeMonths(size: string) {
  const s = size.toLowerCase();
  const months = s.match(/(\d+)\s*(?:[-–/]|à|to|till)?\s*(\d+)?\s*(?:m\b|mo\b|mois|mån|months?)/);
  if (months) return Number(months[2] ?? months[1]);
  const years = s.match(/(\d+)\s*(?:[-–/]|à|to|till)?\s*(\d+)?\s*(?:y\b|yrs?|years?|ans?\b|år)/);
  if (years) return Number(years[2] ?? years[1]) * 12 + 11;
  return null;
}

const largestNumber = (s: string | null) => {
  const all = (s ?? "").match(/\d+(?:[.,]\d+)?/g);
  return all ? Math.max(...all.map((x) => Number(x.replace(",", ".")))) : null;
};

// Probably too small for the kid now: below their current size ("92" < "98";
// "86/92" counts as 92), or, for sizes in months or for clothes when no current
// size is set, made for younger kids than they are.
export function probablyTooSmall(itemSize: string | null, current: string | null, ageMonths?: number | null, shoes = false) {
  if (!itemSize) return false;
  const byAge = sizeMonths(itemSize);
  if (byAge !== null) return ageMonths != null && byAge < ageMonths;
  const a = largestNumber(itemSize);
  const b = largestNumber(current);
  if (a !== null && b !== null) return a < b;
  if (shoes || a === null || ageMonths == null || a < 44) return false;
  const until = CM_UNTIL_MONTHS.find(([cm]) => a <= cm)?.[1];
  return until !== undefined && until < ageMonths;
}
