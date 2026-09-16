export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  category?: string;
  fromRecipe?: string;
  price?: number | null;
  ahProduct?: AhProduct | null;
  /** Wat deze boodschap zonder bonus zou kosten; leeg als er geen bonus op zit. */
  priceBefore?: number | null;
  /** When AH was last searched for this item, also when nothing matched. */
  priceCheckedAt?: string | null;
}

export interface AhProduct {
  id: number;
  title: string;
  unitSize: string | null;
  quantity: number;
  imageUrl: string | null;
  isBonus: boolean;
  /** AH's own department, e.g. "Zuivel, eieren". */
  category: string | null;
}

export interface UsualItem {
  id: string;
  name: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  instructions?: string;
  imageUrl?: string;
  sourceUrl?: string;
  macros?: Macros;
  servings?: number;
  /** Labels like "Vega" or "Snel"; a recipe can sit in more than one. */
  categories?: string[];
}

export interface RecipeCategory {
  id: string;
  name: string;
  color: string;
}

export interface PantryItem {
  id: string;
  name: string;
  /** How many you have; 0 means you are out. */
  quantity: number;
  /** Set by hand when what is left will not get you through the week. */
  low: boolean;
  source: string;
  updatedAt?: string;
}
