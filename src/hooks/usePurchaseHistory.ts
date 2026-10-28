import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { countParts } from '@/lib/itemCount';

interface FrequentItem {
  name: string;
  count: number;
}

/** "2 bananen" en "bananen" zijn hetzelfde product; het aantal hoort bij die ene keer. */
export const historyName = (itemName: string) => countParts(itemName).rest.trim().toLowerCase();

// Oudere rijen bewaarden het aantal nog in de naam; die tellen mee bij het kale product.
const topItems = (rows: { item_name: string; purchase_count: number }[]): FrequentItem[] => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = historyName(row.item_name);
    if (name) totals.set(name, (totals.get(name) ?? 0) + row.purchase_count);
  }
  return [...totals]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

export const usePurchaseHistory = (userId: string | null) => {
  // Alles wat jullie ooit haalden, vaakst eerst: de top vijf als knoppen, de rest voor aanvullen tijdens typen.
  const [knownItems, setKnownItems] = useState<FrequentItem[]>([]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data } = await supabase
        .from('purchase_history')
        .select('item_name, purchase_count')
        .eq('user_id', userId)
        .order('purchase_count', { ascending: false })
        .limit(300);

      setKnownItems(topItems(data || []));
    };

    load();
  }, [userId]);

  const trackPurchase = useCallback(async (itemName: string) => {
    if (!userId) return;

    const normalized = historyName(itemName);
    if (!normalized) return;

    // Upsert: increment count or insert with count 1
    const { data: existing } = await supabase
      .from('purchase_history')
      .select('id, purchase_count')
      .eq('user_id', userId)
      .eq('item_name', normalized)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('purchase_history')
        .update({
          purchase_count: existing.purchase_count + 1,
          last_purchased_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('purchase_history')
        .insert({ user_id: userId, item_name: normalized, purchase_count: 1 });
    }

    // Refresh top items
    const { data } = await supabase
      .from('purchase_history')
      .select('item_name, purchase_count')
      .eq('user_id', userId)
      .order('purchase_count', { ascending: false })
      .limit(300);

    setKnownItems(topItems(data || []));
  }, [userId]);

  const frequentItems = useMemo(() => knownItems.slice(0, 5), [knownItems]);

  return { frequentItems, knownItems, trackPurchase };
};
