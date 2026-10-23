import { assertEquals } from 'jsr:@std/assert@1';
import { bericht, isSoort, schoneNamen, stilNu } from './tekst.ts';

Deno.test('één ding toegevoegd noemt het bij naam', () => {
  const b = bericht({ soort: 'toegevoegd', namen: ['melk'] }, 'Sam');
  assertEquals(b.title, 'Sam zette melk op de lijst');
  assertEquals(b.tab, 'list');
});

Deno.test('meer dingen worden opgesomd, met een rest', () => {
  assertEquals(bericht({ soort: 'toegevoegd', namen: ['melk', 'eieren'] }, 'Sam').body, 'melk en eieren');
  const b = bericht({ soort: 'toegevoegd', namen: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'Sam');
  assertEquals(b.title, 'Sam zette 6 dingen op de lijst');
  assertEquals(b.body, 'a, b, c, d en nog 2');
});

Deno.test('zonder naam heet de afzender iemand uit je Cart Club', () => {
  assertEquals(bericht({ soort: 'winkel' }, null).title, 'Iemand uit je Cart Club is boodschappen aan het doen');
  assertEquals(bericht({ soort: 'winkel' }, '  ').title, 'Iemand uit je Cart Club is boodschappen aan het doen');
});

Deno.test('klaar telt wat er gehaald is', () => {
  assertEquals(bericht({ soort: 'klaar', aantal: 12 }, 'Lisa').body, '12 dingen gehaald.');
  assertEquals(bericht({ soort: 'klaar', aantal: 1 }, 'Lisa').body, '1 ding gehaald.');
  assertEquals(bericht({ soort: 'klaar' }, 'Lisa').body, 'Alles is binnen.');
});

Deno.test('voorraad op opent de voorraad', () => {
  const b = bericht({ soort: 'voorraad', namen: ['Koffie'] }, 'Lisa');
  assertEquals(b.title, 'Koffie is op');
  assertEquals(b.tab, 'pantry');
});

Deno.test('namen worden kort en schoon gehouden', () => {
  assertEquals(schoneNamen(['  melk  ', '', 3, 'a'.repeat(80)]), ['melk', 'a'.repeat(60)]);
  assertEquals(schoneNamen('melk'), []);
  assertEquals(schoneNamen(Array(30).fill('x')).length, 20);
});

Deno.test('alleen bekende soorten', () => {
  assertEquals(isSoort('winkel'), true);
  assertEquals(isSoort('spam'), false);
  assertEquals(isSoort(undefined), false);
});

Deno.test('stille uren in de tijdzone van de ontvanger', () => {
  // 21:30 UTC is 23:30 in Amsterdam (zomertijd) en 22:30 in Londen.
  const laat = new Date('2026-07-01T21:30:00Z');
  assertEquals(stilNu(laat, 'Europe/Amsterdam'), true);
  assertEquals(stilNu(new Date('2026-07-01T12:00:00Z'), 'Europe/Amsterdam'), false);
  // 06:30 UTC is 8:30 in Amsterdam: weer wakker.
  assertEquals(stilNu(new Date('2026-07-01T06:30:00Z'), 'Europe/Amsterdam'), false);
  assertEquals(stilNu(new Date('2026-07-01T05:30:00Z'), 'Europe/Amsterdam'), true);
  // Een onbekende tijdzone valt terug op Amsterdam.
  assertEquals(stilNu(laat, 'Nergens/Niets'), true);
});
