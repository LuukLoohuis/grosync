// Prijsvergelijking per lijst: wat dezelfde boodschappen kosten bij AH, Jumbo en Dirk.
// Alleen pure functies; het zoeken en kiezen staat in index.ts.

import type { Store } from './winkels.ts';

/** Het goedkoopste passende product voor één regel bij één winkel. */
export type Keuze = {
  itemId: string;
  store: Store;
  title: string;
  unitSize: string;
  unitPrice: number;
  quantity: number;
  price: number;
  priceBefore: number | null;
  isBonus: boolean;
  bonusMechanism: string | null;
  imageUrl: string | null;
  productUrl: string;
  /** "€ 3,18 per kg", om te zien of de keuze eerlijk is. Null als de maat onleesbaar is. */
  perEenheid: Eenheidsprijs | null;
};

export type Eenheidsprijs = { prijs: number; eenheid: 'kg' | 'l' | 'stuk' };

export type WinkelTotaal = {
  store: Store;
  /** Alles wat deze winkel heeft. */
  totaal: number;
  /** Alleen de regels die alle winkels hebben; dit vergelijk je. */
  eerlijkTotaal: number;
  /** Wat de aanbiedingen in het eerlijke totaal schelen. */
  bonusVoordeel: number;
  gevonden: number;
  ontbreekt: string[];
};

const MAAT: Record<string, { eenheid: Eenheidsprijs['eenheid']; factor: number }> = {
  g: { eenheid: 'kg', factor: 0.001 }, gr: { eenheid: 'kg', factor: 0.001 }, gram: { eenheid: 'kg', factor: 0.001 },
  kg: { eenheid: 'kg', factor: 1 }, kilo: { eenheid: 'kg', factor: 1 }, kilogram: { eenheid: 'kg', factor: 1 },
  ml: { eenheid: 'l', factor: 0.001 }, cl: { eenheid: 'l', factor: 0.01 }, dl: { eenheid: 'l', factor: 0.1 },
  l: { eenheid: 'l', factor: 1 }, lt: { eenheid: 'l', factor: 1 }, liter: { eenheid: 'l', factor: 1 },
  st: { eenheid: 'stuk', factor: 1 }, stuk: { eenheid: 'stuk', factor: 1 }, stuks: { eenheid: 'stuk', factor: 1 },
};

const getal = (tekst: string) => Number(tekst.replace(',', '.'));
const rond = (bedrag: number) => Math.round(bedrag * 100) / 100;

/**
 * "500 g" → € per kg, "6 x 330 ml" → € per liter, "6 stuks" → € per stuk.
 * Leest de maten van AH ("ca. 400 g"), Jumbo ("1,5 l") en Dirk ("500 gram").
 */
export function eenheidsprijs(unitSize: string, price: number): Eenheidsprijs | null {
  const tekst = unitSize.toLowerCase().replace(/^ca\.?\s*/, '').trim();
  if (/^per\s+stuk$/.test(tekst)) return { prijs: rond(price), eenheid: 'stuk' };
  const match = tekst.match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*([a-z]+)\b/);
  if (!match) return null;
  const maat = MAAT[match[3]];
  const hoeveel = (match[1] ? Number(match[1]) : 1) * getal(match[2]) * (maat?.factor ?? 0);
  if (!maat || !(hoeveel > 0) || !(price > 0)) return null;
  return { prijs: rond(price / hoeveel), eenheid: maat.eenheid };
}

/**
 * Per winkel het totaal, en het eerlijke totaal over alleen de regels die elke
 * winkel heeft: een winkel die de saffraan mist, lijkt anders goedkoper dan hij is.
 * Goedkoopste eerst.
 */
export function totalen(itemIds: string[], keuzes: Keuze[], stores: readonly Store[]): WinkelTotaal[] {
  const bij = (store: Store) => new Map(keuzes.filter((k) => k.store === store).map((k) => [k.itemId, k]));
  const perWinkel = new Map(stores.map((store) => [store, bij(store)]));
  const overal = itemIds.filter((id) => stores.every((store) => perWinkel.get(store)!.has(id)));
  return stores
    .map((store) => {
      const gekozen = perWinkel.get(store)!;
      const eerlijk = overal.map((id) => gekozen.get(id)!);
      return {
        store,
        totaal: rond([...gekozen.values()].reduce((som, k) => som + k.price, 0)),
        eerlijkTotaal: rond(eerlijk.reduce((som, k) => som + k.price, 0)),
        bonusVoordeel: rond(eerlijk.reduce((som, k) => som + (k.priceBefore != null ? k.priceBefore - k.price : 0), 0)),
        gevonden: gekozen.size,
        ontbreekt: itemIds.filter((id) => !gekozen.has(id)),
      };
    })
    .sort((a, b) => a.eerlijkTotaal - b.eerlijkTotaal || b.gevonden - a.gevonden);
}
