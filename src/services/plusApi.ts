import { callFunction } from '@/services/functions';

export type PlusPlan = 'maand' | 'jaar';

/** Prijzen zoals ze in Stripe staan; alleen de weergave, de echte prijs komt van Stripe. */
export const PLUS_PRIJS: Record<PlusPlan, { label: string; bedrag: string; bij: string }> = {
  maand: { label: 'Per maand', bedrag: '€ 1,99', bij: 'maandelijks opzegbaar' },
  // 12 × 1,99 is 23,88; op een jaar scheelt dat 8,89, oftewel ruim vier maanden.
  jaar: { label: 'Per jaar', bedrag: '€ 14,99', bij: '4 maanden gratis' },
};

/** Wordt gegooid zolang er nog geen Stripe-sleutels staan. */
export class BetalenUitError extends Error {
  constructor() {
    super('Betalen staat nog niet aan');
    this.name = 'BetalenUitError';
  }
}

const roep = async (naam: string, body: unknown) => {
  try {
    return await callFunction<{ url?: string }>(naam, body);
  } catch (error) {
    if (error instanceof Error && /betalen-uit/.test(error.message)) throw new BetalenUitError();
    throw error;
  }
};

/** Stuurt je naar de betaalpagina van Stripe. */
export const startCheckout = async (plan: PlusPlan) => {
  const data = await roep('stripe-checkout', { plan });
  if (!data?.url) throw new Error('Geen betaalpagina gekregen');
  window.location.href = data.url;
};

/** Opzeggen, bonnetjes en betaalgegevens: allemaal bij Stripe zelf. */
export const openPortal = async () => {
  const data = await roep('stripe-portal', {});
  if (!data?.url) throw new Error('Geen klantportaal gekregen');
  window.location.href = data.url;
};
