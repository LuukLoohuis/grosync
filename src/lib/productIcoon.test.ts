import { describe, expect, it } from 'vitest';
import { beginletter, productIcoon } from '@/lib/productIcoon';

describe('productIcoon', () => {
  it('geeft het product zelf', () => {
    expect(productIcoon('5 bananen')).toBe('🍌');
    expect(productIcoon('appels')).toBe('🍎');
    expect(productIcoon('2 melk')).toBe('🥛');
    expect(productIcoon('eieren')).toBe('🥚');
    expect(productIcoon('shampoo')).toBe('🧴');
  });

  it('kiest het specifieke woord boven het algemene', () => {
    expect(productIcoon('pindakaas')).toBe('🥜');
    expect(productIcoon('kokosmelk')).toBe('🥥');
    expect(productIcoon('hagelslag')).toBe('🍫');
    expect(productIcoon('appelsap')).toBe('🧃');
    expect(productIcoon('tandpasta')).toBe('🪥');
  });

  it('kent Italiaanse kaas, vleeswaren, paddenstoelen en sauzen', () => {
    expect(productIcoon('gran padano 2x')).toBe('🧀');
    expect(productIcoon('prosciutto')).toBe('🥓');
    expect(productIcoon('mortadella')).toBe('🍖');
    expect(productIcoon('oesterzwammen')).toBe('🍄');
    expect(productIcoon('tomatensaus italiaans merk')).toBe('🥫');
  });

  it('geeft niets bij een onbekend product, wel een beginletter', () => {
    expect(productIcoon('olijfolie')).toBe(null);
    expect(beginletter('2 gran padano')).toBe('G');
    expect(beginletter('12')).toBe('?');
  });
});
