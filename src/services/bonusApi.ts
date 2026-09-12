import { supabase } from '@/integrations/supabase/client';
import type { Recipe } from '@/types';

export interface BonusHit {
  ingredient: string;
  title: string;
  mechanism: string | null;
  price: number | null;
  priceBefore: number | null;
  productId: number;
}

export interface BonusMatch {
  recipeId: string;
  name: string;
  ingredientCount: number;
  hits: BonusHit[];
  saving: number;
}

export interface BonusOffer {
  title: string;
  category: string | null;
  price: number | null;
  price_before: number | null;
  mechanism: string | null;
}

export interface BonusResult {
  matches: BonusMatch[];
  bonusCount: number;
  endDate: string | null;
  sample?: BonusOffer[];
}

export interface BonusRecipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string;
  servings: number;
  minutes: number | null;
  usedBonus: string[];
}

/** Asks which of your own recipes are cheaper this week; the bonus itself is fetched once for everyone. */
export async function fetchBonusMatches(recipes: Recipe[]): Promise<BonusResult> {
  const { data, error } = await supabase.functions.invoke('ah-bonus', {
    body: { recipes: recipes.map(({ id, name, ingredients }) => ({ id, name, ingredients })) },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as BonusResult;
}

/** Lets the model cook up three dinners from this week's offers, with your staples as a given. */
export async function fetchBonusRecipes(offers: BonusOffer[], staples: string[]): Promise<BonusRecipe[]> {
  const { data, error } = await supabase.functions.invoke('bonus-recipes', { body: { offers, staples } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.recipes ?? []) as BonusRecipe[];
}
