import { describe, expect, it } from 'vitest';
import { productIcoon } from '@/lib/productIcoon';

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
  });

  it('valt terug op de afdeling', () => {
    expect(productIcoon('olijfolie')).toBe('🥫');
    expect(productIcoon('iets onbekends')).toBe('🥫');
  });
});
