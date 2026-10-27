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

/** Prijs per kg, liter of stuk, en hoeveel daarvan in één pak zit. */
export type Eenheidsprijs = { prijs: number; eenheid: 'kg' | 'l' | 'stuk'; hoeveelheid: number };

export type WinkelTotaal = {
  store: Store;
  /** Alles wat deze winkel heeft. */
  totaal: number;
  /**
   * Alleen de regels die alle winkels hebben, en per regel voor dezelfde
   * hoeveelheid (het kleinste pak van de drie): 30 eieren tegen 6 is anders geen vergelijking.
   */
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
  if (/^per\s+stuk$/.test(tekst)) return { prijs: rond(price), eenheid: 'stuk', hoeveelheid: 1 };
  const match = tekst.match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*([a-z]+)\b/);
  if (!match) return null;
  const maat = MAAT[match[3]];
  const hoeveel = (match[1] ? Number(match[1]) : 1) * getal(match[2]) * (maat?.factor ?? 0);
  if (!maat || !(hoeveel > 0) || !(price > 0)) return null;
  return { prijs: rond(price / hoeveel), eenheid: maat.eenheid, hoeveelheid: Math.round(hoeveel * 1000) / 1000 };
}

const MAAT_IN_TEKST = /(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:g|gr|gram|kg|kilo|ml|cl|dl|l|lt|liter|st|stuks?)\b/gi;

/** De maat uit een titel, voor Jumbo zonder maat: "Jumbo Scharreleieren M/L 6 Stuks" → "6 Stuks". */
export const maatInTitel = (title: string): string => [...title.matchAll(MAAT_IN_TEKST)].pop()?.[0] ?? '';

const HALF = /\bhalf\b/i;
const HEEL = /\bheel\b/i;

/**
 * Eenheidsprijs uit de maat, en anders uit de titel. Brood gaat per stuk, maar
 * een half brood is een half stuk: € 0,99 voor een half telt als € 1,98 per heel.
 */
export function eenheidsprijsVan(product: { unitSize: string; title: string; price: number }): Eenheidsprijs | null {
  const per = eenheidsprijs(product.unitSize, product.price)
    ?? eenheidsprijs(maatInTitel(product.title), product.price)
    ?? (HALF.test(product.title) || HEEL.test(product.title) ? eenheidsprijs('per stuk', product.price) : null);
  if (per && per.eenheid === 'stuk' && per.hoeveelheid === 1 && HALF.test(product.title)) {
    return { prijs: rond(product.price * 2), eenheid: 'stuk', hoeveelheid: 0.5 };
  }
  return per;
}

/**
 * Wat elke winkel voor deze regel kost bij dezelfde hoeveelheid: het kleinste
 * pak van de drie, tegen de prijs per eenheid van elke winkel. Zonder vergelijkbare
 * eenheden (kg tegen stuks) gewoon de prijs van wat je koopt.
 */
export function gelijkeHoeveelheid(keuzes: Keuze[]): number[] {
  const eenheden = keuzes.map((k) => k.perEenheid);
  const vergelijkbaar = eenheden.every((e) => e && e.eenheid === eenheden[0]!.eenheid);
  if (!vergelijkbaar) return keuzes.map((k) => k.price);
  const totaal = keuzes.map((k) => k.perEenheid!.hoeveelheid * k.quantity);
  const maat = Math.min(...totaal);
  return keuzes.map((k, i) => rond((k.price / totaal[i]) * maat));
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
  // Per regel de prijs bij dezelfde hoeveelheid, in de volgorde van stores.
  const gelijk = new Map(overal.map((id) => [id, gelijkeHoeveelheid(stores.map((store) => perWinkel.get(store)!.get(id)!))]));
  return stores
    .map((store, plek) => {
      const gekozen = perWinkel.get(store)!;
      const eerlijk = overal.map((id) => gekozen.get(id)!);
      return {
        store,
        totaal: rond([...gekozen.values()].reduce((som, k) => som + k.price, 0)),
        eerlijkTotaal: rond(overal.reduce((som, id) => som + gelijk.get(id)![plek], 0)),
        bonusVoordeel: rond(eerlijk.reduce((som, k) => som + (k.priceBefore != null ? k.priceBefore - k.price : 0), 0)),
        gevonden: gekozen.size,
        ontbreekt: itemIds.filter((id) => !gekozen.has(id)),
      };
    })
    .sort((a, b) => a.eerlijkTotaal - b.eerlijkTotaal || b.gevonden - a.gevonden);
}

// Een pak tot zoveel keer het kleinste passende pak telt nog als gewone maat;
// daarboven is het een groot- of gezinsverpakking (30 eieren tegen 6).
const MAX_PAK_FACTOR = 2.5;

/**
 * Het goedkoopste product uit wat al door het ingrediëntfilter kwam: laagste prijs
 * per eenheid, in de eenheid die de meeste kandidaten delen, zonder grootverpakkingen.
 * Zonder leesbare maten de laagste pakprijs. Bij gelijke prijs wint de eerste.
 */
export function kiesGoedkoopste<T extends { unitSize: string; title: string; price: number }>(kandidaten: T[]): T | null {
  if (kandidaten.length === 0) return null;
  const metPrijs = kandidaten
    .map((product) => ({ product, per: eenheidsprijsVan(product) }))
    .filter((k): k is { product: T; per: Eenheidsprijs } => k.per !== null);
  if (metPrijs.length === 0) {
    return kandidaten.reduce((best, k) => (k.price < best.price ? k : best));
  }
  const telling = new Map<Eenheidsprijs['eenheid'], number>();
  for (const { per } of metPrijs) telling.set(per.eenheid, (telling.get(per.eenheid) ?? 0) + 1);
  const eenheid = [...telling.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const zelfde = metPrijs.filter((k) => k.per.eenheid === eenheid);
  const kleinste = Math.min(...zelfde.map((k) => k.per.hoeveelheid));
  const gewoon = zelfde.filter((k) => k.per.hoeveelheid <= kleinste * MAX_PAK_FACTOR);
  // Exact per eenheid vergelijken, niet op de afgeronde centen.
  const perEenheid = (k: { product: T; per: Eenheidsprijs }) => k.product.price / k.per.hoeveelheid;
  return gewoon.reduce((best, k) => (perEenheid(k) < perEenheid(best) ? k : best)).product;
}

/**
 * Woorden die van een gewoon product iets anders maken. Staat het woord in de
 * titel maar niet in de regel zelf, dan valt het product af, zonder het model.
 * Plantaardig staat er niet in: pindakaas van AH heet zo.
 */
const ANDERS = [
  /\ba la creme\b/, /\bmet (?:room|kaas|saus)\b/, /\bgekruid\b/, /\bgemarineerd\b/,
  /\bpasta\w*/, /\bpizza\w*/, /\bgratin\b/, /\boven\b/, /\bmozzarella\b/, /\btex[ -]?mex\b/,
  /\bparmezaans?\b/, /\bparmigiano\b/, /\bstrooikaas\b/,
  /\bgerookt\w*/, /\bvleeswaren\b/,
  /\bbio\b/, /\bbiologisch\w*/,
  /\bmini\b/,
];

const gewoneTekst = (tekst: string) => tekst.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valt dit product af voor deze regel? "AH Pasta geraspte kaas" voor "geraspte kaas": ja. */
export function vasteWeglaat(regel: string, titel: string): boolean {
  const r = gewoneTekst(regel);
  const t = gewoneTekst(titel);
  return ANDERS.some((woord) => woord.test(t) && !woord.test(r));
}
