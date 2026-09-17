import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Maandag van de week waarin deze datum valt, als YYYY-MM-DD. */
const weekStart = (date = new Date()) => {
  const d = new Date(date);
  const dag = d.getDay();
  d.setDate(d.getDate() - dag + (dag === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
};

/**
 * Hoe vaak een recept in de weekplanning stond. Alleen weken die geweest zijn
 * tellen mee: wat jullie volgende week van plan zijn, heb je nog niet gemaakt.
 */
export const useCookCounts = (userId: string | null) => {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) {
      setCounts(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('recipe_id')
        .eq('user_id', userId)
        .not('recipe_id', 'is', null)
        .lte('week_start', weekStart());
      if (error) {
        console.error('Reading cook counts failed:', error);
        return;
      }
      if (cancelled) return;
      const geteld = new Map<string, number>();
      for (const row of data ?? []) {
        const id = row.recipe_id as string | null;
        if (id) geteld.set(id, (geteld.get(id) ?? 0) + 1);
      }
      setCounts(geteld);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return counts;
};
