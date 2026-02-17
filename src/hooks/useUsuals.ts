import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UsualItem } from '@/types';

interface UseUsualsOptions {
  userId?: string | null;
}

export const useUsuals = ({ userId }: UseUsualsOptions = {}) => {
  const [usuals, setUsuals] = useState<UsualItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('usuals')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      setUsuals(
        (data || []).map((d) => ({
          id: d.id,
          name: d.name,
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
      .channel(`usuals-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usuals', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const d = payload.new as any;
            setUsuals((prev) => {
              if (prev.find((i) => i.id === d.id)) return prev;
              return [...prev, { id: d.id, name: d.name }].sort((a, b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === 'UPDATE') {
            const d = payload.new as any;
            setUsuals((prev) =>
              prev.map((i) => (i.id === d.id ? { id: d.id, name: d.name } : i))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
          } else if (payload.eventType === 'DELETE') {
            setUsuals((prev) => prev.filter((i) => i.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addUsual = useCallback(async (name: string) => {
    if (!userId) return;
    await supabase.from('usuals').insert({ user_id: userId, name });
  }, [userId]);

  const removeUsual = useCallback(async (id: string) => {
    setUsuals((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('usuals').delete().eq('id', id);
  }, []);

  return { usuals, loading, addUsual, removeUsual };
};
