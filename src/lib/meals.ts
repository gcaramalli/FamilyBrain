// Meals journal: slots, food groups (to see how balanced a week is) and places.
// Labels are English and translated on display with t(label).
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type MealPlace = "home" | "out" | "takeaway";

export const MEAL_SLOTS: { id: MealSlot; label: string; emoji: string }[] = [
  { id: "breakfast", label: "Breakfast", emoji: "🥣" },
  { id: "lunch", label: "Lunch", emoji: "🥪" },
  { id: "dinner", label: "Dinner", emoji: "🍽" },
  { id: "snack", label: "Snack", emoji: "🍎" },
];

// Kept short on purpose: enough to notice "no fish this week" or "red meat
// four times", not a nutrition tracker.
export const FOOD_GROUPS: { id: string; label: string; emoji: string }[] = [
  { id: "vegetables", label: "Vegetables", emoji: "🥦" },
  { id: "fruit", label: "Fruit", emoji: "🍓" },
  { id: "legumes", label: "Legumes", emoji: "🫘" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "poultry", label: "Poultry", emoji: "🍗" },
  { id: "red_meat", label: "Red meat", emoji: "🥩" },
  { id: "processed_meat", label: "Sausage, ham", emoji: "🌭" },
  { id: "eggs", label: "Eggs", emoji: "🥚" },
  { id: "dairy", label: "Dairy, cheese", emoji: "🧀" },
  { id: "starch", label: "Pasta, rice, potatoes, bread", emoji: "🍝" },
  { id: "treat", label: "Sweets, fried, fast food", emoji: "🍟" },
];
export const FOOD_GROUP_IDS = FOOD_GROUPS.map((g) => g.id) as [string, ...string[]];

export const MEAL_PLACES: { id: MealPlace; label: string; emoji: string }[] = [
  { id: "home", label: "At home", emoji: "🏠" },
  { id: "out", label: "Out", emoji: "🍴" },
  { id: "takeaway", label: "Takeaway", emoji: "🥡" },
];

// How a kid took a meal (kid tab → Food).
export const REACTIONS = [
  { id: "loved", label: "Loved it", emoji: "😋" },
  { id: "ok", label: "Ate a bit", emoji: "🙂" },
  { id: "refused", label: "Refused", emoji: "🙅" },
] as const;

// Slot that fits the time of day, for a meal logged "now".
export function slotNow(d = new Date()): MealSlot {
  const h = d.getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : "dinner";
}

// How many meals in `meals` touch each food group.
export function groupCounts(meals: { food_groups: string[] }[]) {
  const counts: Record<string, number> = {};
  for (const m of meals) for (const g of m.food_groups) counts[g] = (counts[g] ?? 0) + 1;
  return counts;
}
