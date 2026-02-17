import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GroceryItem } from '@/types';

interface UseGroceryItemsOptions {
  userId?: string | null;
}

export const useGroceryItems = ({ userId }: UseGroceryItemsOptions = {}) => {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load items
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      setGroceryItems(
        (data || []).map((d) => ({
          id: d.id,
          name: d.name,
          checked: d.checked,
          fromRecipe: d.from_recipe || undefined,
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
      .channel(`grocery-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grocery_items', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const d = payload.new as any;
            setGroceryItems((prev) => {
              if (prev.find((i) => i.id === d.id)) return prev;
              return [...prev, { id: d.id, name: d.name, checked: d.checked, fromRecipe: d.from_recipe || undefined }];
            });
          } else if (payload.eventType === 'UPDATE') {
            const d = payload.new as any;
            setGroceryItems((prev) =>
              prev.map((i) => (i.id === d.id ? { id: d.id, name: d.name, checked: d.checked, fromRecipe: d.from_recipe || undefined } : i))
            );
          } else if (payload.eventType === 'DELETE') {
            setGroceryItems((prev) => prev.filter((i) => i.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addGroceryItem = useCallback(async (name: string, fromRecipe?: string) => {
    if (!userId) return;
    await supabase.from('grocery_items').insert({ user_id: userId, name, from_recipe: fromRecipe || null });
  }, [userId]);

  const toggleGroceryItem = useCallback(async (id: string) => {
    const item = groceryItems.find((i) => i.id === id);
    if (!item) return;
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
    await supabase.from('grocery_items').update({ checked: !item.checked }).eq('id', id);
  }, [groceryItems]);

  const removeGroceryItem = useCallback(async (id: string) => {
    setGroceryItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('grocery_items').delete().eq('id', id);
  }, []);

  const clearCheckedItems = useCallback(async () => {
    if (!userId) return;
    const checkedIds = groceryItems.filter((i) => i.checked).map((i) => i.id);
    if (checkedIds.length === 0) return;
    setGroceryItems((prev) => prev.filter((i) => !i.checked));
    await supabase.from('grocery_items').delete().in('id', checkedIds);
  }, [userId, groceryItems]);

  const clearAllItems = useCallback(async () => {
    if (!userId) return;
    setGroceryItems([]);
    await supabase.from('grocery_items').delete().eq('user_id', userId);
  }, [userId]);

  const addRecipeToGroceryList = useCallback(async (ingredients: string[], recipeName: string) => {
    if (!userId) return;
    const existing = groceryItems.map((i) => i.name.toLowerCase());
    const newItems = ingredients
      .filter((ing) => !existing.includes(ing.toLowerCase()))
      .map((ing) => ({ user_id: userId, name: ing, from_recipe: recipeName }));
    if (newItems.length > 0) {
      await supabase.from('grocery_items').insert(newItems);
    }
  }, [userId, groceryItems]);

  return {
    groceryItems,
    loading,
    addGroceryItem,
    toggleGroceryItem,
    removeGroceryItem,
    clearCheckedItems,
    clearAllItems,
    addRecipeToGroceryList,
  };
};
