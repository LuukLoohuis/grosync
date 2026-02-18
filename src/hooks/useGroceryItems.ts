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

  const mergeDuplicateItems = useCallback(async () => {
    if (!userId) return;

    // Parse quantity from item name, e.g. "2 bananen" -> { qty: 2, base: "bananen" }
    const parseItem = (name: string): { qty: number | null; base: string } => {
      const match = name.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
      if (match) {
        return { qty: parseFloat(match[1].replace(',', '.')), base: match[2].toLowerCase().trim() };
      }
      return { qty: null, base: name.toLowerCase().trim() };
    };

    const uncheckedItems = groceryItems.filter((i) => !i.checked);
    const groups = new Map<string, { items: typeof uncheckedItems; totalQty: number | null }>();

    for (const item of uncheckedItems) {
      const { qty, base } = parseItem(item.name);
      const existing = groups.get(base);
      if (existing) {
        existing.items.push(item);
        if (qty !== null && existing.totalQty !== null) {
          existing.totalQty += qty;
        }
      } else {
        groups.set(base, { items: [item], totalQty: qty });
      }
    }

    const idsToDelete: string[] = [];
    const updates: { id: string; name: string }[] = [];

    for (const [base, group] of groups) {
      if (group.items.length <= 1) continue;

      const keepItem = group.items[0];
      const removeItems = group.items.slice(1);
      idsToDelete.push(...removeItems.map((i) => i.id));

      if (group.totalQty !== null) {
        // Items had quantities -> sum them
        const newName = `${group.totalQty % 1 === 0 ? group.totalQty : group.totalQty.toFixed(1)} ${base}`;
        updates.push({ id: keepItem.id, name: newName });
      }
      // Items without quantities -> just remove duplicates, keep one as-is
    }

    if (idsToDelete.length === 0) return;

    // Optimistic update
    setGroceryItems((prev) => {
      let updated = prev.filter((i) => !idsToDelete.includes(i.id));
      for (const upd of updates) {
        updated = updated.map((i) => (i.id === upd.id ? { ...i, name: upd.name } : i));
      }
      return updated;
    });

    // Persist
    await supabase.from('grocery_items').delete().in('id', idsToDelete);
    for (const upd of updates) {
      await supabase.from('grocery_items').update({ name: upd.name }).eq('id', upd.id);
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
    mergeDuplicateItems,
  };
};
