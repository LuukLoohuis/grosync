import { supabase } from '@/integrations/supabase/client';
import { callFunction } from '@/services/functions';
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

// Response of the fetch-url-meta edge function.
export interface FetchedRecipe {
  imageUrl?: string | null;
  name?: string;
  title?: string;
  description?: string;
  ingredients?: Array<string | { name: string; quantity?: string | number; unit?: string }>;
  instructions?: string;
  servings?: number | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  extractedFrom?: 'page' | 'description' | 'linked-page' | 'video' | 'none';
  /** Instagram only: false when Instagram would not show the post to our server. */
  captionFound?: boolean;
}

export async function fetchRecipeFromUrl(url: string) {
  return callFunction<FetchedRecipe>('fetch-url-meta', { url });
}

export async function fetchRecipeFromText(text: string) {
  return callFunction<FetchedRecipe>('fetch-url-meta', { text });
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

export async function suggestRecipes(ingredients: string[], staples: string[] = []): Promise<{ recipes: RecipeSuggestion[] }> {
  // Through invoke, so the call carries your own session and not just the public key.
  const { data, error } = await supabase.functions.invoke('suggest-recipes', { body: { ingredients, staples } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { recipes: RecipeSuggestion[] };
}
