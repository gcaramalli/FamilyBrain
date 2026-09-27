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

// "92" < "98": an item in a size below the kid's current one is probably too
// small. Only compares plain numbers ("86/92" uses the larger one).
export function probablyTooSmall(itemSize: string | null, current: string | null) {
  const num = (s: string | null) => {
    const all = (s ?? "").match(/\d+(?:[.,]\d+)?/g);
    return all ? Math.max(...all.map((x) => Number(x.replace(",", ".")))) : null;
  };
  const a = num(itemSize);
  const b = num(current);
  return a !== null && b !== null && a < b;
}
