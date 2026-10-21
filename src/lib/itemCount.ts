import type { GroceryItem } from '@/types';
import { splitAmount } from '@/lib/itemAmount';

/**
 * Hoeveel je van een boodschap haalt. Zonder AH-product staat dat in de naam
 * ("2 bananen", "3 flessen cola", "2× Kipfilet (500g)"); met AH-product is het
 * het aantal pakken in het mandje, en blijft de naam zoals hij is.
 */
export const MAX_COUNT = 99;

// Verpakkingen tel je: "2 flessen". Gewichten niet: "500 g" wordt "2× … (500 g)".
const PACKAGES: [string, string][] = [
  ['stuk', 'stuks'], ['fles', 'flessen'], ['pak', 'pakken'], ['pakje', 'pakjes'],
  ['blik', 'blikken'], ['blikje', 'blikjes'], ['zak', 'zakken'], ['zakje', 'zakjes'],
  ['doos', 'dozen'], ['pot', 'potten'], ['potje', 'potjes'], ['bos', 'bossen'],
  ['bosje', 'bosjes'], ['krop', 'kroppen'], ['tros', 'trossen'], ['rol', 'rollen'],
  ['bol', 'bollen'], ['plak', 'plakken'], ['punt', 'punten'], ['net', 'netten'],
];
const SINGULAR = new Map(PACKAGES.flatMap(([one, more]) => [[one, one], [more, one]]));
SINGULAR.set('st', 'stuk');
const PLURAL = new Map(PACKAGES);

const TIMES = /^(\d{1,2})\s*[×x]\s+(.+)$/i;
const NUMBER = new RegExp(`^(\\d{1,2})\\s+(?:(${[...SINGULAR.keys()].join('|')})\\.?\\s+)?(.+)$`, 'i');

export interface CountParts {
  count: number;
  /** "flessen" bij "3 flessen cola"; leeg als je gewoon stuks telt. */
  unit: string | null;
  /** De naam zonder het aantal: "cola", "Kipfilet (500g)". */
  rest: string;
  form: 'times' | 'number' | 'none';
}

export const countParts = (raw: string): CountParts => {
  const name = raw.trim();
  const times = name.match(TIMES);
  if (times) return { count: Number(times[1]), unit: null, rest: times[2].trim(), form: 'times' };
  const number = name.match(NUMBER);
  // "50 g gehakt" is een gewicht, geen vijftig stuks.
  const weight = number && !number[2] && /[a-z]/i.test(splitAmount(name).amount ?? '');
  if (number && !weight && Number(number[1]) > 0) {
    return { count: Number(number[1]), unit: number[2] ?? null, rest: number[3].trim(), form: 'number' };
  }
  return { count: 1, unit: null, rest: name, form: 'none' };
};

const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), MAX_COUNT);

const unitFor = (unit: string, n: number) => {
  const one = SINGULAR.get(unit.toLowerCase()) ?? unit;
  const word = n === 1 ? one : PLURAL.get(one) ?? unit;
  // Hoofdletter blijft staan als iemand "Fles" typte.
  return unit[0] === unit[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
};

/** De naam met een ander aantal. Bij 1 valt een kaal getal weg: "bananen", niet "1 bananen". */
export const withCount = (raw: string, n: number): string => {
  const count = clamp(n);
  const { unit, rest, form } = countParts(raw);
  if (form === 'number' && unit) return `${count} ${unitFor(unit, count)} ${rest}`;
  if (count === 1) return rest;
  if (form === 'number') return `${count} ${rest}`;
  // Een naam met gewicht of inhoud ("Kipfilet (500g)", "500 g gehakt") krijgt "2×" ervoor.
  if (form === 'times' || splitAmount(rest).amount) return `${count}× ${rest}`;
  return `${count} ${rest}`;
};

/** Het aantal dat de lijst laat zien en de stepper aanpast. */
export const itemCount = (item: Pick<GroceryItem, 'name' | 'ahProduct'>) =>
  item.ahProduct ? Math.max(1, item.ahProduct.quantity) : countParts(item.name).count;

/** Korte tekst voor de knop: "2×", of "3 flessen" als de naam een verpakking noemt. */
export const countLabel = (item: Pick<GroceryItem, 'name' | 'ahProduct'>) => {
  const count = itemCount(item);
  if (item.ahProduct) return `${count}×`;
  const { unit } = countParts(item.name);
  return unit ? `${count} ${unitFor(unit, count)}` : `${count}×`;
};
