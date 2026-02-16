export interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  category?: string;
  fromRecipe?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  imageUrl?: string;
}
