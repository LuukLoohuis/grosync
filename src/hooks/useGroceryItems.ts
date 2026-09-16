import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { AhMatch } from '@/services/ahApi';
import { GroceryItem } from '@/types';
import { deleteWithUndo } from '@/lib/undoableDelete';
import { flushGroceryChanges, pendingGroceryChanges, saveGroceryChange, type GroceryChange } from '@/lib/offlineQueue';

type GroceryRow = Database['public']['Tables']['grocery_items']['Row'];
type GroceryInsert = Database['public']['Tables']['grocery_items']['Insert'];

const toGroceryItem = (row: GroceryRow): GroceryItem => ({
  id: row.id,
  name: row.name,
  checked: row.checked,
  fromRecipe: row.from_recipe || undefined,
  price: row.price ?? null,
  priceCheckedAt: row.price_checked_at,
  priceBefore: row.price_before ?? null,
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
  price_before: null,
  ah_product_id: null,
  ah_product_title: null,
  ah_unit_size: null,
  ah_quantity: null,
  ah_image_url: null,
  ah_is_bonus: null,
  ah_category: null,
  price_checked_at: null,
};

// The last list this device saw, so the list opens in the store without signal.
const cacheKey = (userId: string) => `couplecart-list-${userId}`;

const readCachedList = (userId: string): GroceryItem[] | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as GroceryItem[]) : null;
  } catch {
    return null;
  }
};

const writeCachedList = (userId: string, items: GroceryItem[]) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(items));
  } catch {
    // Storage full or blocked; the list still works online.
  }
};

// A client-made id lets an item added without signal be checked off or removed before it reaches the server.
const newRow = (userId: string, name: string, fromRecipe?: string): GroceryInsert => ({
  id: crypto.randomUUID(),
  user_id: userId,
  name,
  from_recipe: fromRecipe || null,
  checked: false,
  created_at: new Date().toISOString(),
});

const rowToItem = (row: GroceryInsert): GroceryItem => ({
  id: row.id!,
  name: row.name,
  checked: Boolean(row.checked),
  fromRecipe: row.from_recipe || undefined,
  price: null,
  priceCheckedAt: null,
  ahProduct: null,
});

// Kept changes laid over a list from the server, so they do not flicker away before they are sent.
const withPendingChanges = (items: GroceryItem[], changes: GroceryChange[], userId: string): GroceryItem[] =>
  changes.reduce((list, change) => {
    if (change.kind === 'insert') {
      const added = change.rows.filter((row) => row.user_id === userId && !list.some((i) => i.id === row.id));
      return [...list, ...added.map(rowToItem)];
    }
    if (change.kind === 'delete') return list.filter((i) => !change.ids.includes(i.id));
    return list.map((i) => {
      if (!change.ids.includes(i.id)) return i;
      return {
        ...i,
        ...(change.patch.checked !== undefined ? { checked: change.patch.checked } : {}),
        ...(change.patch.name !== undefined ? { name: change.patch.name } : {}),
      };
    });
  }, items);

interface UseGroceryItemsOptions {
  userId?: string | null;
}

export const useGroceryItems = ({ userId }: UseGroceryItemsOptions = {}) => {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    // Send what was kept without signal first, so the list from the server already includes it.
    await flushGroceryChanges();
    const { data, error } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // No connection: keep showing the list this device has.
    if (!error && data) setGroceryItems(withPendingChanges(data.map(toGroceryItem), pendingGroceryChanges(), userId));
    setLoading(false);
  }, [userId]);

  // Load items: the stored list right away, then the one from the server
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const cached = readCachedList(userId);
    if (cached) {
      setGroceryItems(cached);
      setLoading(false);
    }
    void reload();
  }, [userId, reload]);

  // Keep the stored copy current
  useEffect(() => {
    if (userId && !loading) writeCachedList(userId, groceryItems);
  }, [userId, loading, groceryItems]);

  // Back online: send the kept changes and catch up on what others changed meanwhile
  useEffect(() => {
    const catchUp = () => { void reload(); };
    window.addEventListener('online', catchUp);
    return () => window.removeEventListener('online', catchUp);
  }, [reload]);

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
    const row = newRow(userId, name, fromRecipe);
    setGroceryItems((prev) => [...prev, rowToItem(row)]);
    if (!(await saveGroceryChange({ kind: 'insert', rows: [row] }))) {
      setGroceryItems((prev) => prev.filter((i) => i.id !== row.id));
      toast.error('Toevoegen lukte niet. Probeer het opnieuw.');
    }
  }, [userId]);

  const toggleGroceryItem = useCallback(async (id: string) => {
    const item = groceryItems.find((i) => i.id === id);
    if (!item) return;
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
    await saveGroceryChange({ kind: 'update', ids: [id], patch: { checked: !item.checked } });
  }, [groceryItems]);

  // Sets the state explicitly, so an undo from a toast never flips it the wrong way.
  const setGroceryItemChecked = useCallback(async (id: string, checked: boolean) => {
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, checked } : i));
    await saveGroceryChange({ kind: 'update', ids: [id], patch: { checked } });
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
        if (!(await saveGroceryChange({ kind: 'delete', ids: [id] }))) throw new Error('Delete refused');
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
        if (!(await saveGroceryChange({ kind: 'delete', ids: checkedIds }))) throw new Error('Delete refused');
      },
    });
  }, [userId, groceryItems]);

  const clearAllItems = useCallback(async () => {
    if (!userId) return;
    // The items on screen, by id, so clearing also works without signal.
    const ids = groceryItems.map((i) => i.id);
    setGroceryItems([]);
    if (ids.length > 0) await saveGroceryChange({ kind: 'delete', ids });
  }, [userId, groceryItems]);

  const addRecipeToGroceryList = useCallback(async (ingredients: string[], recipeName: string): Promise<boolean> => {
    if (!userId) return false;
    const rows = ingredients.map((ing) => newRow(userId, ing, recipeName));
    if (rows.length === 0) return true;
    setGroceryItems((prev) => [...prev, ...rows.map(rowToItem)]);
    const saved = await saveGroceryChange({ kind: 'insert', rows });
    if (!saved) setGroceryItems((prev) => prev.filter((i) => !rows.some((row) => row.id === i.id)));
    return saved;
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
    await saveGroceryChange({ kind: 'delete', ids: idsToDelete });
    for (const upd of updates) {
      await saveGroceryChange({ kind: 'update', ids: [upd.id], patch: { name: upd.name, ...CLEARED_AH_MATCH } });
    }
  }, [userId, groceryItems]);

  /** Naam wijzigen. De AH-koppeling gaat eraf: die hoorde bij de oude naam. */
  const renameGroceryItem = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setGroceryItems((prev) => prev.map((i) => (
      i.id === id ? { ...i, name: clean, price: null, priceBefore: null, ahProduct: null, priceCheckedAt: undefined } : i
    )));
    await saveGroceryChange({ kind: 'update', ids: [id], patch: { name: clean, ...CLEARED_AH_MATCH } });
  }, []);

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
      if (unmatched.has(i.id)) return { ...i, price: null, priceBefore: null, ahProduct: null, priceCheckedAt: checkedAt };
      const match = byItem.get(i.id);
      if (!match) return i;
      return {
        ...i,
        price: match.price,
        priceBefore: match.priceBefore ?? null,
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
      price_before: m.priceBefore ?? null,
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
    renameGroceryItem,
    updateGroceryItemPrice,
    applyAhMatches,
  };
};
