import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Recipe } from '@/types';

interface UseRecipesOptions {
  userId?: string | null;
}

export const useRecipes = ({ userId }: UseRecipesOptions = {}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      setRecipes(
        (data || []).map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          ingredients: d.ingredients || [],
          instructions: d.instructions || undefined,
          imageUrl: d.image_url || undefined,
          sourceUrl: d.source_url || undefined,
        }))
      );
      setLoading(false);
    };

    load();
  }, [userId]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`recipes-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `user_id=eq.${userId}` },
        (payload) => {
          const mapRow = (d: any): Recipe => ({
            id: d.id, name: d.name, description: d.description,
            ingredients: d.ingredients || [], instructions: d.instructions || undefined,
            imageUrl: d.image_url || undefined, sourceUrl: d.source_url || undefined,
          });

          if (payload.eventType === 'INSERT') {
            setRecipes((prev) => {
              if (prev.find((r) => r.id === (payload.new as any).id)) return prev;
              return [...prev, mapRow(payload.new)];
            });
          } else if (payload.eventType === 'UPDATE') {
            setRecipes((prev) => prev.map((r) => (r.id === (payload.new as any).id ? mapRow(payload.new) : r)));
          } else if (payload.eventType === 'DELETE') {
            setRecipes((prev) => prev.filter((r) => r.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id'>) => {
    if (!userId) return null;
    const { data } = await supabase
      .from('recipes')
      .insert({
        user_id: userId,
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions || null,
        image_url: recipe.imageUrl || null,
        source_url: recipe.sourceUrl || null,
      })
      .select()
      .single();
    return data?.id || null;
  }, [userId]);

  const updateRecipe = useCallback(async (id: string, updates: Partial<Omit<Recipe, 'id'>>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
    if (updates.instructions !== undefined) dbUpdates.instructions = updates.instructions || null;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl || null;
    if (updates.sourceUrl !== undefined) dbUpdates.source_url = updates.sourceUrl || null;
    await supabase.from('recipes').update(dbUpdates).eq('id', id);
  }, []);

  const removeRecipe = useCallback(async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id);
  }, []);

  const updateRecipeImage = useCallback(async (id: string, imageUrl: string) => {
    await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', id);
  }, []);

  return { recipes, loading, addRecipe, updateRecipe, removeRecipe, updateRecipeImage };
};
