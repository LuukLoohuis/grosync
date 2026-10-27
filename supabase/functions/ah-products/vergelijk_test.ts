import { assertEquals } from 'jsr:@std/assert@1';
import { eenheidsprijs, eenheidsprijsVan, gelijkeHoeveelheid, maatInTitel, totalen, type Keuze } from './vergelijk.ts';

Deno.test('eenheidsprijs leest de maten van AH, Jumbo en Dirk', () => {
  const per = (maat: string, prijs: number) => {
    const e = eenheidsprijs(maat, prijs);
    return e && [e.prijs, e.eenheid, e.hoeveelheid];
  };
  assertEquals(per('500 g', 1.59), [3.18, 'kg', 0.5]);
  assertEquals(per('ca. 400 g', 2), [5, 'kg', 0.4]);
  assertEquals(per('500 gram', 1), [2, 'kg', 0.5]);
  assertEquals(per('1 kg', 2.49), [2.49, 'kg', 1]);
  assertEquals(per('1 kg (ca. 5 stuks)', 1.15), [1.15, 'kg', 1]);
  assertEquals(per('1,5 l', 1.5), [1, 'l', 1.5]);
  assertEquals(per('750 ml', 1.5), [2, 'l', 0.75]);
  assertEquals(per('6 x 330 ml', 3.96), [2, 'l', 1.98]);
  assertEquals(per('6 stuks', 3), [0.5, 'stuk', 6]);
  assertEquals(per('per stuk', 0.89), [0.89, 'stuk', 1]);
});

Deno.test('maat uit de titel als Jumbo er geen geeft', () => {
  assertEquals(maatInTitel('Jumbo Scharreleieren M/L 6 Stuks'), '6 Stuks');
  assertEquals(maatInTitel('Halfvolle Melk 1 L'), '1 L');
  assertEquals(maatInTitel('Waldkorn - Volkoren Brood - Half'), '');
  assertEquals(eenheidsprijsVan({ unitSize: '', title: 'Jumbo Scharreleieren M/L 6 Stuks', price: 2.49 })?.prijs, 0.42);
});

Deno.test('eenheidsprijs zonder leesbare maat: null', () => {
  assertEquals(eenheidsprijs('', 1), null);
  assertEquals(eenheidsprijs('per bos', 1), null);
  assertEquals(eenheidsprijs('500 g', 0), null);
});

const keuze = (store: Keuze['store'], itemId: string, price: number, priceBefore: number | null = null): Keuze => ({
  itemId, store, title: itemId, unitSize: '', unitPrice: price, quantity: 1, price, priceBefore,
  isBonus: priceBefore != null, bonusMechanism: null, imageUrl: null, productUrl: '', perEenheid: null,
});

Deno.test('totalen vergelijkt alleen wat elke winkel heeft', () => {
  const uit = totalen(['melk', 'brood', 'saffraan'], [
    keuze('AH', 'melk', 1.2), keuze('AH', 'brood', 2.5), keuze('AH', 'saffraan', 4),
    keuze('Jumbo', 'melk', 1.1), keuze('Jumbo', 'brood', 2.4, 2.9),
    keuze('Dirk', 'melk', 1), keuze('Dirk', 'brood', 2.2), keuze('Dirk', 'saffraan', 3.5),
  ], ['AH', 'Jumbo', 'Dirk']);
  assertEquals(uit.map((w) => [w.store, w.eerlijkTotaal, w.totaal]), [
    ['Dirk', 3.2, 6.7],
    ['Jumbo', 3.5, 3.5],
    ['AH', 3.7, 7.7],
  ]);
  assertEquals(uit.find((w) => w.store === 'Jumbo')?.ontbreekt, ['saffraan']);
  assertEquals(uit.find((w) => w.store === 'Jumbo')?.bonusVoordeel, 0.5);
});

Deno.test('totalen: bij gelijke prijs eerst de winkel die meer vond', () => {
  const uit = totalen(['a', 'b'], [keuze('AH', 'a', 1), keuze('Dirk', 'a', 1), keuze('Dirk', 'b', 2)], ['AH', 'Dirk']);
  assertEquals(uit.map((w) => w.store), ['Dirk', 'AH']);
});

const metMaat = (store: Keuze['store'], itemId: string, price: number, eenheid: 'kg' | 'stuk', hoeveelheid: number): Keuze => ({
  ...keuze(store, itemId, price), perEenheid: { prijs: price / hoeveelheid, eenheid, hoeveelheid },
});

Deno.test('gelijkeHoeveelheid: 30 eieren tegen 6 telt als 6', () => {
  assertEquals(gelijkeHoeveelheid([metMaat('AH', 'e', 8.49, 'stuk', 30), metMaat('Dirk', 'e', 1.43, 'stuk', 6)]), [1.7, 1.43]);
});

Deno.test('gelijkeHoeveelheid: kg tegen stuks of zonder maat is gewoon de prijs', () => {
  assertEquals(gelijkeHoeveelheid([metMaat('AH', 'b', 1.99, 'stuk', 5), metMaat('Dirk', 'b', 1.15, 'kg', 1)]), [1.99, 1.15]);
  assertEquals(gelijkeHoeveelheid([metMaat('AH', 'b', 1.99, 'stuk', 5), keuze('Dirk', 'b', 1.15)]), [1.99, 1.15]);
});

Deno.test('totalen rekent per regel met dezelfde hoeveelheid', () => {
  const uit = totalen(['e'], [metMaat('AH', 'e', 8.49, 'stuk', 30), metMaat('Dirk', 'e', 1.43, 'stuk', 6)], ['AH', 'Dirk']);
  assertEquals(uit.map((w) => [w.store, w.eerlijkTotaal, w.totaal]), [['Dirk', 1.43, 1.43], ['AH', 1.7, 8.49]]);
});
