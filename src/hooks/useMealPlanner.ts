import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Recipe } from '@/types';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  id: string;
  dayIndex: number;
  mealType: MealType;
  recipeId: string | null;
  customMealName: string | null;
  recipe?: Recipe;
}

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export const useMealPlanner = (userId: string | null, recipes: Recipe[]) => {
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart());

  const navigateWeek = useCallback((offset: number) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset * 7);
      return d.toISOString().split('T')[0];
    });
  }, []);

  // Load entries
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    const load = async () => {
      const { data } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStart);

      const mapped: MealPlanEntry[] = (data || []).map((d: any) => ({
        id: d.id,
        dayIndex: d.day_index,
        mealType: d.meal_type as MealType,
        recipeId: d.recipe_id,
        customMealName: d.custom_meal_name,
        recipe: d.recipe_id ? recipes.find((r) => r.id === d.recipe_id) : undefined,
      }));
      setEntries(mapped);
      setLoading(false);
    };

    load();
  }, [userId, weekStart, recipes]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`meal-plans-${userId}-${weekStart}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'meal_plans',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const d = payload.new as any;
          if (d.week_start !== weekStart) return;
          const entry: MealPlanEntry = {
            id: d.id, dayIndex: d.day_index, mealType: d.meal_type,
            recipeId: d.recipe_id, customMealName: d.custom_meal_name,
            recipe: d.recipe_id ? recipes.find((r) => r.id === d.recipe_id) : undefined,
          };
          setEntries((prev) => {
            const idx = prev.findIndex((e) => e.id === d.id);
            if (idx >= 0) return prev.map((e, i) => i === idx ? entry : e);
            return [...prev, entry];
          });
        } else if (payload.eventType === 'DELETE') {
          setEntries((prev) => prev.filter((e) => e.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, weekStart, recipes]);

  const setMeal = useCallback(async (dayIndex: number, mealType: MealType, recipeId: string | null, customName?: string) => {
    if (!userId) return;
    // Upsert
    const { data } = await supabase
      .from('meal_plans')
      .upsert({
        user_id: userId,
        week_start: weekStart,
        day_index: dayIndex,
        meal_type: mealType,
        recipe_id: recipeId,
        custom_meal_name: customName || null,
      } as any, { onConflict: 'user_id,week_start,day_index,meal_type' })
      .select()
      .single();

    if (data) {
      const entry: MealPlanEntry = {
        id: (data as any).id, dayIndex, mealType,
        recipeId, customMealName: customName || null,
        recipe: recipeId ? recipes.find((r) => r.id === recipeId) : undefined,
      };
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.dayIndex === dayIndex && e.mealType === mealType);
        if (idx >= 0) return prev.map((e, i) => i === idx ? entry : e);
        return [...prev, entry];
      });
    }
  }, [userId, weekStart, recipes]);

  const removeMeal = useCallback(async (dayIndex: number, mealType: MealType) => {
    if (!userId) return;
    const entry = entries.find((e) => e.dayIndex === dayIndex && e.mealType === mealType);
    if (!entry) return;
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    await supabase.from('meal_plans').delete().eq('id', entry.id);
  }, [userId, entries]);

  const clearWeek = useCallback(async () => {
    if (!userId) return;
    setEntries([]);
    await supabase.from('meal_plans').delete().eq('user_id', userId).eq('week_start', weekStart);
  }, [userId, weekStart]);

  const getEntry = useCallback((dayIndex: number, mealType: MealType) => {
    return entries.find((e) => e.dayIndex === dayIndex && e.mealType === mealType);
  }, [entries]);

  // Get all ingredients from planned meals for grocery list
  const getPlannedIngredients = useCallback(() => {
    const ingredients: { ingredient: string; recipeName: string }[] = [];
    for (const entry of entries) {
      if (entry.recipe || (entry.recipeId && recipes.find(r => r.id === entry.recipeId))) {
        const recipe = entry.recipe || recipes.find(r => r.id === entry.recipeId);
        if (recipe) {
          for (const ing of recipe.ingredients) {
            ingredients.push({ ingredient: ing, recipeName: recipe.name });
          }
        }
      }
    }
    return ingredients;
  }, [entries, recipes]);

  return {
    entries, loading, weekStart, navigateWeek,
    setMeal, removeMeal, clearWeek, getEntry, getPlannedIngredients,
  };
};
