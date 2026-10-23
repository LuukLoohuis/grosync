import type { GroceryItem } from '@/types';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { t } from '@/lib/i18n';

type Regel = Pick<GroceryItem, 'name' | 'checked' | 'ahProduct' | 'note'>;

/**
 * De lijst als gewone tekst, per afdeling in de looproute van de winkel. Voor
 * WhatsApp of een berichtje aan iemand die CoupleCart niet heeft.
 */
export const lijstAlsTekst = (items: Regel[]): string => {
  const open = items.filter((i) => !i.checked);
  if (open.length === 0) return '';
  const blokken = sortByStoreRoute(open).map((groep) => [
    groep.label,
    ...groep.items.map((item) => {
      // Bij een AH-product staat het aantal niet in de naam, maar in de koppeling.
      const aantal = item.ahProduct && item.ahProduct.quantity > 1 ? ` (${item.ahProduct.quantity}×)` : '';
      const notitie = item.note ? ` – ${item.note}` : '';
      return `• ${item.name}${aantal}${notitie}`;
    }),
  ].join('\n'));
  return [
    t('Boodschappen ({0})', [open.length]),
    ...blokken,
    t('Via CoupleCart · couplecart.nl'),
  ].join('\n\n');
};

export type DeelUitkomst = 'gedeeld' | 'gekopieerd' | 'afgebroken' | 'mislukt';

/** Via het deelmenu van de telefoon; zonder deelmenu (desktop) naar het klembord. */
export const deelTekst = async (tekst: string): Promise<DeelUitkomst> => {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: tekst });
      return 'gedeeld';
    } catch (error) {
      // Zelf weggetikt is geen fout; een geweigerde share valt terug op kopiëren.
      if (error instanceof DOMException && error.name === 'AbortError') return 'afgebroken';
    }
  }
  try {
    await navigator.clipboard.writeText(tekst);
    return 'gekopieerd';
  } catch {
    return 'mislukt';
  }
};
