import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FrequentItem {
  name: string;
  count: number;
}

export const usePurchaseHistory = (userId: string | null) => {
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data } = await supabase
        .from('purchase_history')
        .select('item_name, purchase_count')
        .eq('user_id', userId)
        .order('purchase_count', { ascending: false })
        .limit(5);

      setFrequentItems(
        (data || []).map((d: any) => ({ name: d.item_name, count: d.purchase_count }))
      );
    };

    load();
  }, [userId]);

  const trackPurchase = useCallback(async (itemName: string) => {
    if (!userId) return;

    const normalized = itemName.trim().toLowerCase();
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
      .limit(5);

    setFrequentItems(
      (data || []).map((d: any) => ({ name: d.item_name, count: d.purchase_count }))
    );
  }, [userId]);

  return { frequentItems, trackPurchase };
};
