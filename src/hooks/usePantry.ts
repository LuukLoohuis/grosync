import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PantryItem } from '@/types';
import { isLevel, sameProduct, type PantryLevel } from '@/lib/pantry';

interface UsePantryOptions {
  userId?: string | null;
}

const mapRow = (row: Record<string, unknown>): PantryItem => ({
  id: String(row.id),
  name: String(row.name),
  level: isLevel(String(row.level)) ? (String(row.level) as PantryLevel) : 'ruim',
  source: String(row.source ?? 'handmatig'),
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

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
        .select('id, name, level, source, updated_at')
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

  /** Adds the product, or lifts one that is already there back to that level. */
  const stockUp = useCallback(async (name: string, level: PantryLevel = 'ruim', source = 'handmatig') => {
    const clean = name.trim();
    if (!clean || !userId) return;

    const existing = pantry.find((item) => sameProduct(item.name, clean));
    if (existing) {
      if (existing.level === level) return;
      setPantry((prev) => prev.map((item) => (item.id === existing.id ? { ...item, level } : item)));
      await supabase.from('pantry_items').update({ level, updated_at: new Date().toISOString() }).eq('id', existing.id);
      return;
    }

    const { data, error } = await supabase
      .from('pantry_items')
      .insert([{ user_id: userId, name: clean, level, source }])
      .select('id, name, level, source, updated_at')
      .single();
    // A second device may have added the same product; the unique index catches that.
    if (error) { console.error('Failed to stock item:', error); return; }
    if (data) setPantry((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, mapRow(data)]));
  }, [pantry, userId]);

  const setLevel = useCallback(async (id: string, level: PantryLevel) => {
    setPantry((prev) => prev.map((item) => (item.id === id ? { ...item, level } : item)));
    await supabase.from('pantry_items').update({ level, updated_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const removePantryItem = useCallback(async (id: string) => {
    setPantry((prev) => prev.filter((item) => item.id !== id));
    await supabase.from('pantry_items').delete().eq('id', id);
  }, []);

  return { pantry, pantryLoading: loading, stockUp, setLevel, removePantryItem };
};
