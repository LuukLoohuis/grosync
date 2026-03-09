// Recipe API service - Direct calls to Supabase Edge Functions
const SUPABASE_PROJECT_ID = 'wguzdygvwtacfbzqwnxa';
const FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicmVmIjoiYWJjZTEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5NTI2NTE1MCwiZXhwIjoyNDYxODQxMTUwfQ.Yy-TT0SLbDjXYl-fFNQIrBzFG0xd9yJvVKRnz4s4fKk';

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
