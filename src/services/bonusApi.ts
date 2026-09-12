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

export interface BonusResult {
  matches: BonusMatch[];
  bonusCount: number;
  endDate: string | null;
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
