import { supabase } from '@/integrations/supabase/client';

export interface ScanHit {
  name: string;
  /** How sure the model is that this product really stands there, 0–1. */
  sure: number;
}

/** Sends one photo to be read. The image is not stored anywhere; only the names come back. */
export const scanPantryPhoto = async (image: string): Promise<ScanHit[]> => {
  const { data, error } = await supabase.functions.invoke('pantry-scan', { body: { image } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.items) ? data.items : [];
};
