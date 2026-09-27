import { Baby, Bell, Brain, BriefcaseBusiness, CalendarDays, ChartColumn, ChefHat, CookingPot, House, ListChecks, Lock, Receipt, Settings, ShoppingCart, UserRound, Utensils, type LucideIcon } from "lucide-react";

// Each part of the app has its own hue, used only to find your way (tab icons,
// hub tiles, page titles). Data about people keeps the people's colours.
export const MODULES = {
  today: { color: "#5b8def", Icon: House },
  calendar: { color: "#9b7bf0", Icon: CalendarDays },
  todo: { color: "#3fbf7f", Icon: ListChecks },
  kids: { color: "#f5904a", Icon: Baby },
  kitchen: { color: "#f2b441", Icon: CookingPot },
  shopping: { color: "#f2b441", Icon: ShoppingCart },
  meals: { color: "#4f9bf5", Icon: Utensils },
  recipes: { color: "#f5904a", Icon: ChefHat },
  purchases: { color: "#3fbf7f", Icon: Receipt },
  brain: { color: "#f0826f", Icon: Brain },
  me: { color: "#e07ab4", Icon: UserRound },
  private: { color: "#e07ab4", Icon: Lock },
  work: { color: "#c98a4b", Icon: BriefcaseBusiness },
  profile: { color: "#5b8def", Icon: UserRound },
  connections: { color: "#2fc2b0", Icon: Bell },
  family: { color: "#7d8cf2", Icon: Settings },
  stats: { color: "#3fbf7f", Icon: ChartColumn },
} satisfies Record<string, { color: string; Icon: LucideIcon }>;

export type ModuleId = keyof typeof MODULES;
