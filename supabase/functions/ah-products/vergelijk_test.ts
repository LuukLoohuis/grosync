import { assertEquals } from 'jsr:@std/assert@1';
import { eenheidsprijs, eenheidsprijsVan, gelijkeHoeveelheid, kiesGoedkoopste, maatInTitel, totalen, type Keuze } from './vergelijk.ts';

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

const p = (title: string, unitSize: string, price: number) => ({ title, unitSize, price });

Deno.test('kiesGoedkoopste: laagste prijs per eenheid, niet laagste pakprijs', () => {
  const huismerk = p('Jumbo Pindakaas Naturel 600 g', '600 g', 1.35);
  assertEquals(kiesGoedkoopste([p('Terra pindakaas', '350 g', 2.49), huismerk, p('Calvé', '350 g', 3.49)]), huismerk);
});

Deno.test('kiesGoedkoopste: geen grootverpakking', () => {
  const zes = p('Eieren 6 stuks', '6 stuks', 1.79);
  assertEquals(kiesGoedkoopste([p('Eieren 30 stuks', '30 stuks', 7.49), zes, p('Eieren 10 stuks', '10 stuks', 3.2)]), zes);
  // 10 tegen 6 is nog gewoon: dan wint de goedkoopste per stuk.
  const tien = p('Eieren 10 stuks', '10 stuks', 2.5);
  assertEquals(kiesGoedkoopste([zes, tien]), tien);
});

Deno.test('kiesGoedkoopste: eenheid van de meeste kandidaten, maat uit titel', () => {
  const kilo = p('Bananen', '1 kg', 1.15);
  assertEquals(kiesGoedkoopste([p('Bananen 5 Stuks', '', 0.5), kilo, p('Bio bananen', '1 kg', 1.99), p('Bananen tros', '1,2 kg', 1.5)]), kilo);
  assertEquals(kiesGoedkoopste([p('Jumbo Scharreleieren 6 Stuks', '', 2.49), p('Scharreleieren 10 Stuks', '', 3.5)])?.title, 'Scharreleieren 10 Stuks');
});

Deno.test('kiesGoedkoopste: zonder maten de laagste pakprijs, leeg is null', () => {
  const goedkoop = p('Volkoren half', '', 1.19);
  assertEquals(kiesGoedkoopste([p('Waldkorn half', '', 1.39), goedkoop]), goedkoop);
  assertEquals(kiesGoedkoopste([]), null);
});

Deno.test('brood: een half is een half stuk, ook zonder maat', () => {
  assertEquals(eenheidsprijsVan({ title: 'AH Rond volkoren half', unitSize: 'per stuk', price: 0.99 }), { prijs: 1.98, eenheid: 'stuk', hoeveelheid: 0.5 });
  assertEquals(eenheidsprijsVan({ title: 'Waldkorn - Volkoren Brood - Half', unitSize: '', price: 1.39 }), { prijs: 2.78, eenheid: 'stuk', hoeveelheid: 0.5 });
  assertEquals(eenheidsprijsVan({ title: 'Rond volkoren heel', unitSize: 'Per stuk', price: 0.93 }), { prijs: 0.93, eenheid: 'stuk', hoeveelheid: 1 });
  // Een half voor € 0,99 is duurder per brood dan een heel voor € 1,89.
  assertEquals(kiesGoedkoopste([p('AH Rond volkoren half', 'per stuk', 0.99), p('AH Rond volkoren heel', 'per stuk', 1.89)])?.title, 'AH Rond volkoren heel');
});

Deno.test('brood: half tegen heel vergelijkt per heel brood', () => {
  const half = metMaat('AH', 'b', 0.99, 'stuk', 0.5);
  const heel = metMaat('Dirk', 'b', 0.93, 'stuk', 1);
  assertEquals(gelijkeHoeveelheid([half, heel]), [0.99, 0.47]);
});
