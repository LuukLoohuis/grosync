import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/i18n';

/** The two things that cost real money; the rest is free for everyone. */
export type MeteredFeature = 'recept' | 'kastfoto';

export const FREE_LIMIT = 5;

export const FEATURE_LABEL: Record<MeteredFeature, string> = {
  recept: t('recepten ophalen'),
  kastfoto: t('kastfoto’s'),
};

/** The month the meter runs in, in Dutch time, as the database writes it. */
const currentPeriod = () => {
  const now = new Date();
  const dutch = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return `${dutch.getFullYear()}-${String(dutch.getMonth() + 1).padStart(2, '0')}`;
};

interface UseEntitlementsOptions {
  userId?: string | null;
}

/** Plus, and what is left of this month's free allowance. */
export const useEntitlements = ({ userId }: UseEntitlementsOptions = {}) => {
  const [plus, setPlus] = useState(false);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setPlus(false); setUsed({}); setIsAdmin(false); return; }

    const [plusRow, usage, admin] = await Promise.all([
      supabase.from('plus_members').select('expires_at').eq('user_id', userId).maybeSingle(),
      supabase.from('ai_usage').select('feature, count').eq('user_id', userId).eq('period', currentPeriod()),
      supabase.rpc('is_admin'),
    ]);

    const row = plusRow.data;
    setPlus(Boolean(row) && (!row?.expires_at || new Date(row.expires_at) > new Date()));
    setUsed(Object.fromEntries((usage.data ?? []).map((item) => [item.feature, item.count])));
    setIsAdmin(admin.data === true);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const remaining = useCallback(
    (feature: MeteredFeature) => (plus ? Infinity : Math.max(0, FREE_LIMIT - (used[feature] ?? 0))),
    [plus, used],
  );

  return { plus, isAdmin, used, remaining, refreshEntitlements: load };
};
