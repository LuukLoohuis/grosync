import type { GroceryItem } from '@/types';

/** De winkels die je met één tik kiest; een andere typ je zelf. */
export const VASTE_WINKELS = ['AH', 'Jumbo', 'Kruidvat', 'Action', 'Markt'] as const;

const sleutel = (winkel: string) => winkel.trim().toLocaleLowerCase('nl');

export const zelfdeWinkel = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && sleutel(a) === sleutel(b));

/** Netjes als knop: een bekende winkel zoals hij hoort ("ah" → "AH"), de rest met een hoofdletter. */
export const winkelNaam = (getypt: string): string => {
  const schoon = getypt.trim().replace(/\s+/g, ' ').slice(0, 30);
  const vast = VASTE_WINKELS.find((w) => zelfdeWinkel(w, schoon));
  if (vast) return vast;
  return schoon.charAt(0).toLocaleUpperCase('nl') + schoon.slice(1);
};

/** De winkels die op de open boodschappen staan, de vaste eerst in hun eigen volgorde. */
export const winkelsOpLijst = (items: Pick<GroceryItem, 'store' | 'checked'>[]): string[] => {
  const gezien: string[] = [];
  for (const item of items) {
    if (item.checked || !item.store) continue;
    if (!gezien.some((w) => zelfdeWinkel(w, item.store))) gezien.push(winkelNaam(item.store));
  }
  const rang = (w: string) => {
    const i = VASTE_WINKELS.findIndex((v) => zelfdeWinkel(v, w));
    return i === -1 ? VASTE_WINKELS.length : i;
  };
  return gezien.sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, 'nl'));
};

/**
 * Wat je in deze winkel haalt: alles met dit label plus alles zonder label
 * (dat maakt niet uit waar). Zonder gekozen winkel: alles.
 */
export const voorWinkel = <T extends Pick<GroceryItem, 'store'>>(items: T[], winkel: string | null): T[] =>
  winkel ? items.filter((i) => !i.store || zelfdeWinkel(i.store, winkel)) : items;
