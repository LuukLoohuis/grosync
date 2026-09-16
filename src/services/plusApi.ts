import { callFunction } from '@/services/functions';

export type PlusPlan = 'maand' | 'jaar';

/** Prijzen zoals ze in Stripe staan; alleen de weergave, de echte prijs komt van Stripe. */
export const PLUS_PRIJS: Record<PlusPlan, { label: string; bedrag: string; bij: string }> = {
  maand: { label: 'Per maand', bedrag: '€ 2,49', bij: 'maandelijks opzegbaar' },
  jaar: { label: 'Per jaar', bedrag: '€ 19,99', bij: 'twee maanden gratis' },
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
