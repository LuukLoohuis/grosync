import { assertEquals } from 'jsr:@std/assert@1';
import { bouwIndex, zoekTreffers } from './match.ts';

let id = 0;
const product = (title: string, category = 'Zuivel, eieren') =>
  ({ product_id: ++id, title, category, mechanism: '25% korting', price: 1, price_before: 1.5 });

const bonus = [
  product('Philadelphia Knoflook & fijne kruiden'),
  product('Almhof Volle kwark citroen'),
  product("Ben & Jerry's Peanut butter cup", 'Diepvries'),
  product('AH Rauwkost paprika', 'Groente, aardappelen'),
  product('AH Griekse yoghurt'),
  product('AH Citroenen', 'Fruit'),
  product('AH Boterbonen', 'Soepen, sauzen, kruiden, olie'),
];
const index = bouwIndex(bonus);
const titel = (ingredient: string) => zoekTreffers([ingredient], index)[0]?.product.title ?? null;

Deno.test('een smaak is geen product', () => {
  assertEquals(titel('garlic bulb'), null);
  assertEquals(titel('1/2 tsp garlic powder'), null);
  assertEquals(titel('vegan butter'), null);
  assertEquals(titel('1/2 tsp red pepper flakes'), null);
});

Deno.test('het product zelf wint nog steeds', () => {
  assertEquals(titel('lemon'), 'AH Citroenen');
  assertEquals(titel('butter beans'), 'AH Boterbonen');
  assertEquals(titel('200 g greek yoghurt'), 'AH Griekse yoghurt');
  assertEquals(titel('1 red pepper'), 'AH Rauwkost paprika');
});
