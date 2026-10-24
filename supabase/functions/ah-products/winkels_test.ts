import { assertEquals } from 'jsr:@std/assert@1';
import { dirkCandidates, jumboCandidates, jumboNumber, nuxtData } from './winkels.ts';

const page = (payload: unknown[]) =>
  `<html><script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">${JSON.stringify(payload)}</script></html>`;

Deno.test('nuxtData volgt de indexen, ook door Reactive heen', () => {
  const data = nuxtData(page([
    ['Reactive', 1],
    { pinia: 2 },
    { productStore: 3 },
    { products: 4 },
    [5],
    { id: 6, title: 7, price: 8, promo: -1 },
    '723887PAK',
    'Jumbo Passata',
    65,
  ]));
  assertEquals(data.pinia.productStore.products, [{ id: '723887PAK', title: 'Jumbo Passata', price: 65, promo: undefined }]);
});

Deno.test('zonder payload geen data', () => {
  assertEquals(nuxtData('<html></html>'), null);
});

Deno.test('Jumbo: artikelnummer zonder verpakkingscode', () => {
  assertEquals(jumboNumber('723887PAK'), 723887);
  assertEquals(Number.isNaN(jumboNumber('PAK')), true);
});

Deno.test('Jumbo: prijs in centen, actieprijs wint, link naar jumbo.com', () => {
  const [c] = jumboCandidates([{
    id: '1PAK',
    title: 'Mutti Passata',
    link: '/producten/mutti-passata-1PAK',
    image: 'https://img',
    price: { price: 300, promoPrice: 199 },
    promotions: [{ tags: [{ text: '2e halve prijs' }] }],
  }]);
  assertEquals(c.webshopId, 1);
  assertEquals([c.price, c.priceBefore, c.isBonus, c.bonusMechanism], [1.99, 3, true, '2e halve prijs']);
  assertEquals(c.url, 'https://www.jumbo.com/producten/mutti-passata-1PAK');
});

Deno.test('Jumbo: gesponsord en uitverkocht vallen af', () => {
  const base = { title: 'x', link: '/p', price: { price: 100 } };
  const kept = jumboCandidates([
    { ...base, id: '1A', sponsored: true },
    { ...base, id: '2A', availability: { isAvailable: false } },
    { ...base, id: '3A' },
  ]);
  assertEquals(kept.map((c) => c.webshopId), [3]);
});

Deno.test('Dirk: aanbieding houdt de gewone prijs als prijs-ervoor', () => {
  const [c] = dirkCandidates([{
    productId: 124423,
    headerText: 'Passata pomodoro rustica',
    brand: 'Cirio',
    packaging: '680 g',
    price: { normalPrice: 1.79, priceToShow: 1.29, isOffer: true, textPriceSign: '' },
  }]);
  assertEquals([c.title, c.unitSize, c.price, c.priceBefore, c.bonusMechanism], ['Cirio Passata pomodoro rustica', '680 g', 1.29, 1.79, 'Aanbieding']);
  assertEquals(c.url, 'https://www.dirk.nl/boodschappen/x/x/x/124423');
});

Deno.test('Dirk: merk niet dubbel in de titel', () => {
  const [c] = dirkCandidates([{ productId: 1, headerText: 'Cirio Passata', brand: 'Cirio', price: { priceToShow: 1 } }]);
  assertEquals(c.title, 'Cirio Passata');
});
