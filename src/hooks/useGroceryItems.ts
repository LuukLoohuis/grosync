import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { AhMatch } from '@/services/ahApi';
import { GroceryItem } from '@/types';
import { deleteWithUndo } from '@/lib/undoableDelete';

type GroceryRow = Database['public']['Tables']['grocery_items']['Row'];

const toGroceryItem = (row: GroceryRow): GroceryItem => ({
  id: row.id,
  name: row.name,
  checked: row.checked,
  fromRecipe: row.from_recipe || undefined,
  price: row.price ?? null,
  priceCheckedAt: row.price_checked_at,
  ahProduct: row.ah_product_id
    ? {
        id: row.ah_product_id,
        title: row.ah_product_title || '',
        unitSize: row.ah_unit_size,
        quantity: row.ah_quantity || 1,
        imageUrl: row.ah_image_url,
        isBonus: Boolean(row.ah_is_bonus),
        category: row.ah_category,
      }
    : null,
});

// A renamed item (e.g. after merging duplicates) no longer matches its AH product.
const CLEARED_AH_MATCH = {
  price: null,
  ah_product_id: null,
  ah_product_title: null,
  ah_unit_size: null,
  ah_quantity: null,
  ah_image_url: null,
  ah_is_bonus: null,
  ah_category: null,
  price_checked_at: null,
};

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

      setGroceryItems((data || []).map(toGroceryItem));
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
            const item = toGroceryItem(payload.new as GroceryRow);
            setGroceryItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
          } else if (payload.eventType === 'UPDATE') {
            const item = toGroceryItem(payload.new as GroceryRow);
            setGroceryItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
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
    // Zet de nieuwe rij zelf in de lijst in plaats van te wachten op de
    // realtime-melding; die kan uitblijven of traag zijn. De subscriptie
    // hierboven slaat een dubbele id over.
    const { data } = await supabase
      .from('grocery_items')
      .insert({ user_id: userId, name, from_recipe: fromRecipe || null })
      .select()
      .single();
    if (!data) return;
    const item = toGroceryItem(data);
    setGroceryItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
  }, [userId]);

  const toggleGroceryItem = useCallback(async (id: string) => {
    const item = groceryItems.find((i) => i.id === id);
    if (!item) return;
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
    await supabase.from('grocery_items').update({ checked: !item.checked }).eq('id', id);
  }, [groceryItems]);

  // Sets the state explicitly, so an undo from a toast never flips it the wrong way.
  const setGroceryItemChecked = useCallback(async (id: string, checked: boolean) => {
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, checked } : i));
    const { error } = await supabase.from('grocery_items').update({ checked }).eq('id', id);
    if (error) console.error('Updating item failed:', error);
  }, []);

  const removeGroceryItem = useCallback((id: string) => {
    const index = groceryItems.findIndex((i) => i.id === id);
    const item = groceryItems[index];
    if (!item) return;
    deleteWithUndo({
      message: `“${item.name}” verwijderd`,
      remove: () => setGroceryItems((prev) => prev.filter((i) => i.id !== id)),
      restore: () => setGroceryItems((prev) => (
        prev.some((i) => i.id === id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)]
      )),
      commit: async () => {
        const { error } = await supabase.from('grocery_items').delete().eq('id', id);
        if (error) throw error;
      },
    });
  }, [groceryItems]);

  const clearCheckedItems = useCallback(() => {
    if (!userId) return;
    const checkedItems = groceryItems.filter((i) => i.checked);
    if (checkedItems.length === 0) return;
    const checkedIds = checkedItems.map((i) => i.id);
    deleteWithUndo({
      message: checkedItems.length === 1
        ? `“${checkedItems[0].name}” weggehaald`
        : `${checkedItems.length} afgevinkte boodschappen weggehaald`,
      remove: () => setGroceryItems((prev) => prev.filter((i) => !checkedIds.includes(i.id))),
      restore: () => setGroceryItems((prev) => [...prev, ...checkedItems.filter((c) => !prev.some((i) => i.id === c.id))]),
      commit: async () => {
        const { error } = await supabase.from('grocery_items').delete().in('id', checkedIds);
        if (error) throw error;
      },
    });
  }, [userId, groceryItems]);

  const clearAllItems = useCallback(async () => {
    if (!userId) return;
    setGroceryItems([]);
    await supabase.from('grocery_items').delete().eq('user_id', userId);
  }, [userId]);

  const addRecipeToGroceryList = useCallback(async (ingredients: string[], recipeName: string): Promise<boolean> => {
    if (!userId) return false;
    const newItems = ingredients.map((ing) => ({ user_id: userId, name: ing, from_recipe: recipeName }));
    if (newItems.length === 0) return true;
    const { error } = await supabase.from('grocery_items').insert(newItems);
    if (error) console.error('Adding recipe items failed:', error);
    return !error;
  }, [userId]);

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
        updated = updated.map((i) => (i.id === upd.id ? { ...i, name: upd.name, price: null, ahProduct: null } : i));
      }
      return updated;
    });

    // Persist
    await supabase.from('grocery_items').delete().in('id', idsToDelete);
    for (const upd of updates) {
      await supabase.from('grocery_items').update({ name: upd.name, ...CLEARED_AH_MATCH }).eq('id', upd.id);
    }
  }, [userId, groceryItems]);

  const updateGroceryItemPrice = useCallback(async (id: string, price: number | null) => {
    setGroceryItems((prev) => prev.map((i) => (i.id === id ? { ...i, price } : i)));
    await supabase.from('grocery_items').update({ price }).eq('id', id);
  }, []);

  const applyAhMatches = useCallback(async (matches: AhMatch[], unmatchedIds: string[] = []) => {
    if (matches.length === 0 && unmatchedIds.length === 0) return;
    const byItem = new Map(matches.map((m) => [m.itemId, m]));
    const unmatched = new Set(unmatchedIds);
    const checkedAt = new Date().toISOString();
    setGroceryItems((prev) => prev.map((i) => {
      // Marked as searched, so the list can say "Kies zelf · Zoek bij AH".
      if (unmatched.has(i.id)) return { ...i, price: null, ahProduct: null, priceCheckedAt: checkedAt };
      const match = byItem.get(i.id);
      if (!match) return i;
      return {
        ...i,
        price: match.price,
        priceCheckedAt: checkedAt,
        ahProduct: {
          id: match.productId,
          title: match.title,
          unitSize: match.unitSize,
          quantity: match.quantity,
          imageUrl: match.imageUrl,
          isBonus: match.isBonus,
          category: match.category || null,
        },
      };
    }));
    await Promise.all([
      ...matches.map((m) => supabase.from('grocery_items').update({
      price: m.price,
      ah_product_id: m.productId,
      ah_product_title: m.title,
      ah_unit_size: m.unitSize,
      ah_quantity: m.quantity,
      ah_image_url: m.imageUrl,
      ah_is_bonus: m.isBonus,
      ah_category: m.category || null,
      price_checked_at: checkedAt,
      }).eq('id', m.itemId)),
      ...(unmatchedIds.length > 0
        ? [supabase.from('grocery_items').update({ ...CLEARED_AH_MATCH, price_checked_at: checkedAt }).in('id', unmatchedIds)]
        : []),
    ]);
  }, []);

  return {
    groceryItems,
    loading,
    addGroceryItem,
    toggleGroceryItem,
    removeGroceryItem,
    clearCheckedItems,
    clearAllItems,
    setGroceryItemChecked,
    addRecipeToGroceryList,
    mergeDuplicateItems,
    updateGroceryItemPrice,
    applyAhMatches,
  };
};
