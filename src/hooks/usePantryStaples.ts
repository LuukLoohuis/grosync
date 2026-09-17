import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PANTRY_STAPLES } from '@/lib/pantryStaples';
import { t } from '@/lib/i18n';

/** What this account always has at home. Without a saved row the defaults apply. */
export const usePantryStaples = (userId: string | null) => {
  const [pantryStaples, setPantryStaples] = useState<string[]>(DEFAULT_PANTRY_STAPLES);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('pantry_staples')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) console.warn('Could not load settings:', error.message);
      if (!cancelled && data) setPantryStaples(data.pantry_staples);
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const savePantryStaples = useCallback(async (next: string[]) => {
    if (!userId) return;
    const previous = pantryStaples;
    setPantryStaples(next);
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, pantry_staples: next, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Saving settings failed:', error);
      setPantryStaples(previous);
      toast.error(t("Opslaan lukte niet. Probeer het opnieuw."));
    }
  }, [userId, pantryStaples]);

  return { pantryStaples, savePantryStaples };
};
