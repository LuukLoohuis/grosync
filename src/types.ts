export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  category?: string;
  fromRecipe?: string;
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
}
