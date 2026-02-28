// Recipe API service
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

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
  const response = await fetch(`${API_BASE_URL}/api/recipes/add-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch recipe');
  }

  return await response.json();
}

export async function translateRecipe(recipe: RecipeData) {
  const response = await fetch(`${API_BASE_URL}/api/recipes/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to translate recipe');
  }

  return await response.json();
}

export async function calculateMacros(ingredients: string[]) {
  const response = await fetch(`${API_BASE_URL}/api/recipes/calculate-macros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to calculate macros');
  }

  return await response.json();
}
