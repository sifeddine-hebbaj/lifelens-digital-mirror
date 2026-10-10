import { Bus, Clapperboard, Ellipsis, Gift, HeartPulse, Repeat, Shirt, ShoppingBag, Smartphone, Utensils, type LucideIcon } from "lucide-react";
import type { BudgetKey } from "./i18n";

export type CategoryMeta = { key: string; labelKey: BudgetKey; color: string; icon: LucideIcon };

export const CATEGORIES: CategoryMeta[] = [
  { key: "food", labelKey: "cat_food", color: "#d98a45", icon: Utensils },
  { key: "transport", labelKey: "cat_transport", color: "#5a86c4", icon: Bus },
  { key: "phone", labelKey: "cat_phone", color: "#8670c8", icon: Smartphone },
  { key: "subscriptions", labelKey: "cat_subscriptions", color: "#b866b8", icon: Repeat },
  { key: "clothes", labelKey: "cat_clothes", color: "#3f9f9a", icon: Shirt },
  { key: "health", labelKey: "cat_health", color: "#d4624f", icon: HeartPulse },
  { key: "entertainment", labelKey: "cat_entertainment", color: "#c9a22f", icon: Clapperboard },
  { key: "family", labelKey: "cat_family", color: "#d77d9d", icon: Gift },
  { key: "shopping", labelKey: "cat_shopping", color: "#86a23d", icon: ShoppingBag },
  { key: "other", labelKey: "cat_other", color: "#8a9591", icon: Ellipsis },
];

const FALLBACK = CATEGORIES[CATEGORIES.length - 1];
export const categoryMeta = (key: string): CategoryMeta => CATEGORIES.find((category) => category.key === key) ?? FALLBACK;
