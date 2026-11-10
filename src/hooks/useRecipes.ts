import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Recipe } from '@/types';
import { deleteWithUndo } from '@/lib/undoableDelete';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

interface UseRecipesOptions {
  /** Van wie de lijst is waar de app op draait (bij een lid: de eigenaar). */
  userId?: string | null;
  /** Wie er ingelogd is. */
  selfId?: string | null;
  /** Verandert als de club verandert (instappen, uitstappen), zodat de leden opnieuw geladen worden. */
  clubKey?: string;
}

/** Iemand in de Cart Club van wie recepten in het overzicht kunnen staan. */
export interface ClubLid {
  userId: string;
  naam: string | null;
  jij: boolean;
}

const mapRow = (d: any): Recipe => ({
  id: d.id,
  userId: d.user_id,
  name: d.name,
  description: d.description,
  ingredients: d.ingredients || [],
  instructions: d.instructions || undefined,
  imageUrl: d.image_url || undefined,
  sourceUrl: d.source_url || undefined,
  macros: d.macros || undefined,
  servings: d.servings || 4,
  categories: d.categories || [],
  favorite: d.favorite === true,
});

export const useRecipes = ({ userId, selfId = userId, clubKey = '' }: UseRecipesOptions = {}) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [leden, setLeden] = useState<ClubLid[]>([]);
  const [loading, setLoading] = useState(true);

  // Wiens recepten er in het overzicht staan: de lijst waar de app op draait,
  // jijzelf en iedereen anders in de club. Zonder club is dat alleen jij.
  const ids = useMemo(() => {
    const set = new Set<string>();
    if (userId) set.add(userId);
    if (selfId) set.add(selfId);
    for (const lid of leden) set.add(lid.userId);
    return [...set].sort();
  }, [userId, selfId, leden]);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!userId) { setLeden([]); return; }
    let weg = false;
    void supabase.rpc('cart_club_leden').then(({ data, error }) => {
      if (weg) return;
      if (error) { console.error('Loading Cart Club members failed:', error); setLeden([]); return; }
      setLeden((data ?? []).map((l) => ({ userId: l.user_id, naam: l.naam, jij: l.jij })));
    });
    return () => { weg = true; };
  }, [userId, selfId, clubKey]);

  useEffect(() => {
    if (!idsKey) { setLoading(false); return; }
    let weg = false;

    const load = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .in('user_id', idsKey.split(','))
        .order('created_at', { ascending: true });
      if (weg) return;
      setRecipes((data || []).map(mapRow));
      setLoading(false);
    };

    load();
    return () => { weg = true; };
  }, [idsKey]);

  // Real-time subscription
  useEffect(() => {
    if (!idsKey) return;

    const channel = supabase
      .channel(`recipes-${idsKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipes', filter: `user_id=in.(${idsKey})` },
        (payload) => {
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
  }, [idsKey]);

  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id'>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('recipes')
      .insert([{
        user_id: userId,
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions || null,
        image_url: recipe.imageUrl || null,
        source_url: recipe.sourceUrl || null,
        macros: (recipe.macros as any) || null,
        servings: recipe.servings || 4,
        categories: recipe.categories ?? [],
      }])
      .select()
      .single();
    if (error) {
      console.error('Failed to add recipe:', error);
      throw error;
    }
    if (data) {
      // Optimistic update: add to local state immediately
      setRecipes((prev) => {
        if (prev.find((r) => r.id === data.id)) return prev;
        return [...prev, mapRow(data)];
      });
    }
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
    if (updates.macros !== undefined) dbUpdates.macros = updates.macros || null;
    if (updates.servings !== undefined) dbUpdates.servings = updates.servings;
    if (updates.categories !== undefined) dbUpdates.categories = updates.categories;
    if (updates.favorite !== undefined) dbUpdates.favorite = updates.favorite;
    await supabase.from('recipes').update(dbUpdates).eq('id', id);
  }, []);

  /** Het hartje aan of uit. Gaat meteen om; klopt de database niet, dan terug. */
  const toggleFavorite = useCallback(async (id: string) => {
    let nieuw = false;
    setRecipes((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      nieuw = !r.favorite;
      return { ...r, favorite: nieuw };
    }));
    // 'favorite' zit nog niet in de gegenereerde typen; de migratie voegt hem toe.
    const { error } = await supabase.from('recipes').update({ favorite: nieuw } as never).eq('id', id);
    if (error) {
      console.error('Failed to set favourite:', error);
      setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, favorite: !nieuw } : r)));
      toast.error(t('Favoriet maken lukte niet. Probeer het opnieuw.'));
    }
  }, []);

  const removeRecipe = useCallback((id: string) => {
    const index = recipes.findIndex((r) => r.id === id);
    const recipe = recipes[index];
    if (!recipe) return;
    // The database delete waits for the undo window: planned meals that point at
    // this recipe are removed by the foreign key cascade, so they survive an undo.
    deleteWithUndo({
      message: `“${recipe.name}” verwijderd`,
      remove: () => setRecipes((prev) => prev.filter((r) => r.id !== id)),
      restore: () => setRecipes((prev) => (
        prev.some((r) => r.id === id) ? prev : [...prev.slice(0, index), recipe, ...prev.slice(index)]
      )),
      commit: async () => {
        const { error } = await supabase.from('recipes').delete().eq('id', id);
        if (error) throw error;
      },
    });
  }, [recipes]);

  const updateRecipeImage = useCallback(async (id: string, imageUrl: string) => {
    // Meteen in beeld; de database volgt, en de realtime-melding bevestigt het.
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, imageUrl } : r)));
    const { error } = await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', id);
    if (error) console.error('Failed to save recipe image:', error);
  }, []);

  return { recipes, leden, loading, addRecipe, updateRecipe, removeRecipe, updateRecipeImage, toggleFavorite };
};
