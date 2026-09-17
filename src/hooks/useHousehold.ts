import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Eigenaar: anderen zijn aan jou gekoppeld. Lid: jij bent aan iemand gekoppeld. */
export type Rol = 'eigenaar' | 'lid' | 'geen';

export interface Household {
  /** Van wie de lijst, recepten en kast zijn die de app laat zien. */
  ownerId: string | null;
  rol: Rol;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Als lid: terug naar je eigen omgeving. Geeft terug of het gelukt is. */
  leave: () => Promise<boolean>;
}

/**
 * Bepaalt in welk huishouden je zit. Ben je lid van iemands koppeling, dan
 * draait de hele app op diens rijen; anders op die van jezelf.
 */
export const useHousehold = (selfId: string | null): Household => {
  const [ownerId, setOwnerId] = useState<string | null>(selfId);
  const [rol, setRol] = useState<Rol>('geen');
  const [loading, setLoading] = useState(Boolean(selfId));

  const refresh = useCallback(async () => {
    if (!selfId) { setOwnerId(null); setRol('geen'); setLoading(false); return; }
    const [lid, eigenaar] = await Promise.all([
      supabase
        .from('shared_list_members')
        .select('owner_id, created_at')
        .eq('member_id', selfId)
        .neq('owner_id', selfId)
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('shared_list_members')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', selfId)
        .neq('member_id', selfId),
    ]);
    if (lid.error) console.error('Huishouden lezen mislukt:', lid.error);
    const owner = lid.data?.[0]?.owner_id as string | undefined;
    if (owner) {
      setOwnerId(owner);
      setRol('lid');
    } else {
      setOwnerId(selfId);
      setRol((eigenaar.count ?? 0) > 0 ? 'eigenaar' : 'geen');
    }
    setLoading(false);
  }, [selfId]);

  useEffect(() => {
    setLoading(Boolean(selfId));
    void refresh();
  }, [refresh, selfId]);

  const leave = useCallback(async () => {
    if (!selfId) return false;
    const { data, error } = await supabase
      .from('shared_list_members')
      .delete()
      .eq('member_id', selfId)
      .neq('owner_id', selfId)
      .select('id');
    if (error) { console.error('Ontkoppelen mislukt:', error); return false; }
    return (data?.length ?? 0) > 0;
  }, [selfId]);

  return { ownerId, rol, loading, refresh, leave };
};
