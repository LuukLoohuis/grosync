import { callFunction } from '@/services/functions';

export interface ScanHit {
  name: string;
  /** How sure the model is that this product really stands there, 0–1. */
  sure: number;
}

/** Sends one photo to be read. The image is not stored anywhere; only the names come back. */
export const scanPantryPhoto = async (image: string): Promise<ScanHit[]> => {
  const data = await callFunction<{ items?: ScanHit[] }>('pantry-scan', { image });
  return Array.isArray(data?.items) ? data.items : [];
};
