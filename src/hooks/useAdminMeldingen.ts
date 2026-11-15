import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminMelding {
  id: number;
  soort: string;
  user_id: string | null;
  email: string | null;
  gemaakt_op: string;
  gelezen_op: string | null;
}

const KEY = ['admin-meldingen'];

/** De laatste meldingen voor de beheerder; voor iedereen anders leeg. */
export function useAdminMeldingen(isAdmin: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<AdminMelding[]> => {
      const { data, error } = await supabase
        .from('admin_meldingen')
        .select('id, soort, user_id, email, gemaakt_op, gelezen_op')
        .order('gemaakt_op', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const meldingen = query.data ?? [];
  const ongelezen = meldingen.filter((melding) => !melding.gelezen_op).length;

  const allesGelezen = useCallback(async () => {
    const { error } = await supabase.rpc('admin_meldingen_gelezen');
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: KEY });
  }, [queryClient]);

  const vernieuw = useCallback(() => queryClient.invalidateQueries({ queryKey: KEY }), [queryClient]);

  return { meldingen, ongelezen, allesGelezen, vernieuw, laden: query.isLoading };
}
