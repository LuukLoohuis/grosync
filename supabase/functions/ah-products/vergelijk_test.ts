import { assertEquals } from 'jsr:@std/assert@1';
import { eenheidsprijs, totalen, type Keuze } from './vergelijk.ts';

Deno.test('eenheidsprijs leest de maten van AH, Jumbo en Dirk', () => {
  assertEquals(eenheidsprijs('500 g', 1.59), { prijs: 3.18, eenheid: 'kg' });
  assertEquals(eenheidsprijs('ca. 400 g', 2), { prijs: 5, eenheid: 'kg' });
  assertEquals(eenheidsprijs('500 gram', 1), { prijs: 2, eenheid: 'kg' });
  assertEquals(eenheidsprijs('1 kg', 2.49), { prijs: 2.49, eenheid: 'kg' });
  assertEquals(eenheidsprijs('1,5 l', 1.5), { prijs: 1, eenheid: 'l' });
  assertEquals(eenheidsprijs('750 ml', 1.5), { prijs: 2, eenheid: 'l' });
  assertEquals(eenheidsprijs('6 x 330 ml', 3.96), { prijs: 2, eenheid: 'l' });
  assertEquals(eenheidsprijs('6 stuks', 3), { prijs: 0.5, eenheid: 'stuk' });
  assertEquals(eenheidsprijs('per stuk', 0.89), { prijs: 0.89, eenheid: 'stuk' });
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
