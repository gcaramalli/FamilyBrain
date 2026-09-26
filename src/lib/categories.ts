// Grocery aisles, in the order you walk a typical Swedish supermarket.
export const CATEGORIES = [
  { id: "produce", label: "Fruit & veg", emoji: "🥦" },
  { id: "bakery", label: "Bread", emoji: "🍞" },
  { id: "dairy", label: "Dairy & eggs", emoji: "🥛" },
  { id: "meat", label: "Meat & fish", emoji: "🥩" },
  { id: "deli", label: "Cheese & deli", emoji: "🧀" },
  { id: "pantry", label: "Pantry", emoji: "🥫" },
  { id: "frozen", label: "Frozen", emoji: "🧊" },
  { id: "snacks", label: "Snacks & drinks", emoji: "🍫" },
  { id: "baby", label: "Baby", emoji: "🍼" },
  { id: "household", label: "Hygiene & household", emoji: "🧴" },
  { id: "other", label: "Other", emoji: "🛒" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const categoryById = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
export const categoryOrder = (id: string | null | undefined) => {
  const i = CATEGORIES.findIndex((c) => c.id === id);
  return i === -1 ? CATEGORIES.length - 1 : i;
};

// Keyword guess (English, Swedish, French) for items with no known category.
const KEYWORDS: Record<CategoryId, string[]> = {
  produce: ["apple", "äpple", "pomme", "banana", "banan", "orange", "lemon", "citron", "tomat", "tomato", "cucumber", "gurka", "concombre", "salad", "sallad", "salade", "lettuce", "potato", "potatis", "pomme de terre", "onion", "lök", "oignon", "garlic", "vitlök", "ail", "carrot", "morot", "morötter", "carotte", "avocado", "avokado", "avocat", "pepper", "paprika", "poivron", "broccoli", "brocoli", "spinach", "spenat", "épinard", "berries", "bär", "fraise", "strawberr", "jordgubb", "grape", "druv", "raisin", "pear", "päron", "poire", "herbs", "dill", "persil", "basilic", "fruit", "frukt", "veg", "grönsak", "légume", "mushroom", "svamp", "champignon", "zucchini", "courgette"],
  bakery: ["bread", "bröd", "pain", "baguette", "bulle", "bun", "knäcke", "tortilla", "croissant", "brioche", "toast"],
  dairy: ["milk", "mjölk", "lait", "yogurt", "yoghurt", "yaourt", "fil", "butter", "smör", "beurre", "cream", "grädde", "crème", "egg", "ägg", "oeuf", "œuf", "kvarg", "keso", "crème fraîche", "creme fraiche"],
  meat: ["chicken", "kyckling", "poulet", "beef", "nötfärs", "boeuf", "bœuf", "pork", "fläsk", "porc", "mince", "färs", "haché", "sausage", "korv", "saucisse", "bacon", "ham", "skinka", "jambon", "salmon", "lax", "saumon", "fish", "fisk", "poisson", "shrimp", "räk", "crevette", "cod", "torsk", "cabillaud", "tuna", "tonfisk", "thon"],
  deli: ["cheese", "ost", "fromage", "caviar", "kaviar", "pålägg", "salami", "hummus", "olive", "oliv"],
  pantry: ["pasta", "rice", "ris", "riz", "flour", "mjöl", "farine", "sugar", "socker", "sucre", "salt", "sel", "oil", "olja", "huile", "vinegar", "vinäger", "vinaigre", "sauce", "sås", "ketchup", "mustard", "senap", "moutarde", "can", "burk", "conserve", "beans", "bönor", "haricot", "lentil", "linser", "lentille", "cereal", "flingor", "müsli", "muesli", "oats", "havre", "flocon", "coffee", "kaffe", "café", "tea", "te", "thé", "honey", "honung", "miel", "jam", "sylt", "confiture", "spice", "krydd", "épice", "stock", "buljong", "bouillon", "nudl", "noodle", "tacos"],
  frozen: ["frozen", "fryst", "surgelé", "ice cream", "glass", "glace", "frozen peas", "ärtor"],
  snacks: ["chips", "crisps", "chocolate", "choklad", "chocolat", "candy", "godis", "bonbon", "cookie", "kex", "biscuit", "juice", "jus", "soda", "läsk", "water", "vatten", "eau", "beer", "öl", "bière", "wine", "vin", "nuts", "nötter", "noix", "popcorn"],
  baby: ["diaper", "nappy", "nappies", "blöj", "couche", "baby", "bébé", "barnmat", "välling", "formula", "wipes", "våtservett", "lingette", "pouch", "klämmis"],
  household: ["toothpaste", "tandkräm", "dentifrice", "toothbrush", "tandborste", "brosse à dents", "shampoo", "schampo", "shampoing", "soap", "tvål", "savon", "deodorant", "deo", "toilet paper", "toalettpapper", "papier toilette", "paper towel", "hushållspapper", "essuie", "detergent", "tvättmedel", "lessive", "dish", "disk", "vaisselle", "sponge", "svamp", "éponge", "trash bag", "soppås", "sac poubelle", "battery", "batteri", "pile", "tampon", "pads", "binda", "razor", "rakhyvel", "rasoir", "cotton", "bomull", "coton", "cleaner", "rengöring", "nettoyant", "foil", "folie", "aluminium"],
  other: [],
};

export function guessCategory(title: string): CategoryId {
  const t = title.toLowerCase();
  let best: CategoryId = "other";
  let bestLen = 0;
  for (const [cat, words] of Object.entries(KEYWORDS) as [CategoryId, string[]][]) {
    for (const w of words) {
      if (w.length > bestLen && t.includes(w)) {
        best = cat;
        bestLen = w.length;
      }
    }
  }
  return best;
}
