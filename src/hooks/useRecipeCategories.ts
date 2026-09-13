import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RecipeCategory } from '@/types';
import { nextColor, sameName } from '@/lib/recipeCategories';

interface UseRecipeCategoriesOptions {
  userId?: string | null;
}

/** The categories you made yourself, with the colour they were given. */
export const useRecipeCategories = ({ userId }: UseRecipeCategoriesOptions = {}) => {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);

  useEffect(() => {
    if (!userId) { setCategories([]); return; }
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('recipe_categories')
        .select('id, name, color')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) { console.error('Failed to load categories:', error); return; }
      if (active) setCategories((data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.color })));
    };

    load();
    return () => { active = false; };
  }, [userId]);

  /** Makes the category if it is new, and always returns the name to store on the recipe. */
  const addCategory = useCallback(async (name: string, color?: string) => {
    const clean = name.trim();
    if (!clean || !userId) return clean;
    const existing = categories.find((c) => sameName(c.name, clean));
    if (existing) return existing.name;

    const chosen = color ?? nextColor(categories.map((c) => c.color));
    const { data, error } = await supabase
      .from('recipe_categories')
      .insert([{ user_id: userId, name: clean, color: chosen }])
      .select('id, name, color')
      .single();
    // A second device may have made the same category; the unique index catches that.
    if (error) { console.error('Failed to add category:', error); return clean; }
    if (data) setCategories((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    return data?.name ?? clean;
  }, [categories, userId]);

  const removeCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('recipe_categories').delete().eq('id', id);
  }, []);

  return { categories, addCategory, removeCategory };
};
