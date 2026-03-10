// Recipe API service - Direct calls to Supabase Edge Functions
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface RecipeData {
  url?: string;
  name?: string;
  description?: string;
  ingredients?: string[];
  instructions?: string;
  servings?: number;
}

export interface MacrosData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export async function fetchRecipeFromUrl(url: string) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/fetch-url-meta`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recipe');
    }

    return await response.json();
  } catch (error) {
    console.error('fetchRecipeFromUrl error:', error);
    throw error;
  }
}

export async function translateRecipe(recipe: RecipeData) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/translate-recipe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipe),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to translate recipe');
    }

    return await response.json();
  } catch (error) {
    console.error('translateRecipe error:', error);
    throw error;
  }
}

export async function calculateMacros(ingredients: string[]) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/calculate-macros`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate macros');
    }

    return await response.json();
  } catch (error) {
    console.error('calculateMacros error:', error);
    throw error;
  }
}

export interface RecipeSuggestion {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string;
  servings: number;
  extra_needed: string[];
}

export async function suggestRecipes(ingredients: string[]): Promise<{ recipes: RecipeSuggestion[] }> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/suggest-recipes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ingredients }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to suggest recipes');
    }

    return await response.json();
  } catch (error) {
    console.error('suggestRecipes error:', error);
    throw error;
  }
}
