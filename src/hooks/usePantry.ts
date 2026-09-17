import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PantryItem } from '@/types';
import { MAX_QUANTITY, sameProduct } from '@/lib/pantry';
import { deleteWithUndo } from '@/lib/undoableDelete';
import { t } from '@/lib/i18n';

interface UsePantryOptions {
  userId?: string | null;
}

const mapRow = (row: Record<string, unknown>): PantryItem => ({
  id: String(row.id),
  name: String(row.name),
  quantity: typeof row.quantity === 'number' ? row.quantity : 1,
  low: row.low === true,
  source: String(row.source ?? 'handmatig'),
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

const clamp = (value: number) => Math.max(0, Math.min(MAX_QUANTITY, Math.round(value)));

/** What is in the house, shared with whoever shares the list. */
export const usePantry = ({ userId }: UsePantryOptions = {}) => {
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setPantry([]); setLoading(false); return; }
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('id, name, quantity, low, source, updated_at')
        .eq('user_id', userId)
        .order('name', { ascending: true });
      if (error) { console.error('Failed to load pantry:', error); setLoading(false); return; }
      if (!active) return;
      setPantry((data ?? []).map(mapRow));
      setLoading(false);
    };

    load();

    // The other phone puts things away too.
    const channel = supabase
      .channel(`pantry-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pantry_items', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [userId]);

  const patch = useCallback(async (id: string, changes: Partial<PantryItem>) => {
    setPantry((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (changes.name !== undefined) row.name = changes.name;
    if (changes.quantity !== undefined) row.quantity = changes.quantity;
    if (changes.low !== undefined) row.low = changes.low;
    const { error } = await supabase.from('pantry_items').update(row).eq('id', id);
    if (error) console.error('Failed to update pantry item:', error);
  }, []);

  /** Puts one in the cupboard: a new row, or one more of what is already there. */
  const stockUp = useCallback(async (name: string, source = 'handmatig', bump = true) => {
    const clean = name.trim();
    if (!clean || !userId) return;

    const existing = pantry.find((item) => sameProduct(item.name, clean));
    if (existing) {
      // Seeing it on a photo says it is there, not that there is one more of it.
      const quantity = bump ? clamp(existing.quantity + 1) : clamp(Math.max(existing.quantity, 1));
      await patch(existing.id, { quantity, low: false });
      return;
    }

    const { data, error } = await supabase
      .from('pantry_items')
      .insert([{ user_id: userId, name: clean, quantity: 1, low: false, source }])
      .select('id, name, quantity, low, source, updated_at')
      .single();
    // A second device may have added the same product; the unique index catches that.
    if (error) { console.error('Failed to stock item:', error); return; }
    if (data) setPantry((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, mapRow(data)]));
  }, [pantry, patch, userId]);

  const setQuantity = useCallback(async (id: string, quantity: number) => {
    const next = clamp(quantity);
    // Counting back up means it is no longer running out.
    await patch(id, { quantity: next, ...(next > 1 ? { low: false } : {}) });
  }, [patch]);

  const setLow = useCallback(async (id: string, low: boolean) => { await patch(id, { low }); }, [patch]);

  const renamePantryItem = useCallback(async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (pantry.some((item) => item.id !== id && sameProduct(item.name, clean))) return;
    await patch(id, { name: clean });
  }, [pantry, patch]);

  /** Een veeg is zo gebeurd: weg gaat pas echt weg na het ongedaan-maken-venster. */
  const removePantryItem = useCallback(async (id: string) => {
    const index = pantry.findIndex((item) => item.id === id);
    const item = pantry[index];
    if (!item) return;
    deleteWithUndo({
      message: t('“{0}” uit je kast gehaald', [item.name]),
      remove: () => setPantry((prev) => prev.filter((row) => row.id !== id)),
      restore: () => setPantry((prev) => (
        prev.some((row) => row.id === id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)]
      )),
      commit: async () => {
        const { error } = await supabase.from('pantry_items').delete().eq('id', id);
        if (error) throw error;
      },
    });
  }, [pantry]);

  return { pantry, pantryLoading: loading, stockUp, setQuantity, setLow, renamePantryItem, removePantryItem };
};
