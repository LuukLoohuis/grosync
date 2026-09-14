import { supabase } from '@/integrations/supabase/client';

/** Thrown when the monthly free allowance for a feature is used up. */
export class QuotaError extends Error {
  constructor(public feature: string, public used: number, public quota: number) {
    super('Je gratis tegoed voor deze maand is op');
    this.name = 'QuotaError';
  }
}

type HttpErrorish = { context?: { json?: () => Promise<unknown> } };

/**
 * Calls an edge function with the signed-in session, and turns a 402 into a
 * QuotaError so the screen can offer Plus instead of showing an error.
 */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const payload = await (error as HttpErrorish).context?.json?.().catch(() => null) as
      | { error?: string; feature?: string; used?: number; quota?: number }
      | null;
    if (payload?.error === 'limiet') {
      throw new QuotaError(payload.feature ?? '', payload.used ?? 0, payload.quota ?? 0);
    }
    throw new Error(payload?.error || error.message);
  }

  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  return data as T;
}
