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
        .order('created_at', { ascending: true })
        .order('name', { ascending: true });
      if (error) { console.error('Failed to load categories:', error); return; }
      if (active) setCategories((data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.color })));
    };

    load();

    // A category made on the other phone should show up here without a reload.
    const channel = supabase
      .channel(`recipe-categories-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_categories', filter: `user_id=eq.${userId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
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

  /** Keeps the labels on the recipes in step with the category itself. */
  const relabel = useCallback(async (from: string, to: string | null) => {
    if (!userId) return;
    const { data } = await supabase.from('recipes').select('id, categories').eq('user_id', userId);
    for (const row of data ?? []) {
      const labels: string[] = row.categories ?? [];
      if (!labels.some((label) => sameName(label, from))) continue;
      const next = labels.flatMap((label) => (sameName(label, from) ? (to ? [to] : []) : [label]));
      await supabase.from('recipes').update({ categories: next }).eq('id', row.id);
    }
  }, [userId]);

  const renameCategory = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    const current = categories.find((c) => c.id === id);
    if (!clean || !current || current.name === clean) return;
    if (categories.some((c) => c.id !== id && sameName(c.name, clean))) return;

    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: clean } : c)));
    const { error } = await supabase.from('recipe_categories').update({ name: clean }).eq('id', id);
    if (error) {
      console.error('Failed to rename category:', error);
      setCategories((prev) => prev.map((c) => (c.id === id ? current : c)));
      return;
    }
    await relabel(current.name, clean);
  }, [categories, relabel]);

  const recolorCategory = useCallback(async (id: string, color: string) => {
    const current = categories.find((c) => c.id === id);
    if (!current || current.color === color) return;
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
    const { error } = await supabase.from('recipe_categories').update({ color }).eq('id', id);
    if (error) {
      console.error('Failed to recolour category:', error);
      setCategories((prev) => prev.map((c) => (c.id === id ? current : c)));
    }
  }, [categories]);

  /** Removes the category and takes its label off every recipe. */
  const removeCategory = useCallback(async (id: string) => {
    const current = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('recipe_categories').delete().eq('id', id);
    if (current) await relabel(current.name, null);
  }, [categories, relabel]);

  return { categories, addCategory, renameCategory, recolorCategory, removeCategory };
};
