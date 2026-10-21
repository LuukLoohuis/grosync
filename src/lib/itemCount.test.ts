import { describe, expect, it } from 'vitest';
import { countLabel, countParts, itemCount, withCount } from './itemCount';
import { splitAmount } from './itemAmount';

const ah = (quantity: number) => ({ id: 1, title: 'AH Bananen', unitSize: null, quantity, imageUrl: null, isBonus: false, category: null });

describe('itemCount', () => {
  it('leest het aantal uit de naam', () => {
    expect(countParts('2 bananen').count).toBe(2);
    expect(countParts('bananen').count).toBe(1);
    expect(countParts('3 flessen cola')).toEqual({ count: 3, unit: 'flessen', rest: 'cola', form: 'number' });
    expect(countParts('2× Kipfilet (500g)')).toEqual({ count: 2, unit: null, rest: 'Kipfilet (500g)', form: 'times' });
  });

  it('telt gewichten niet als aantal', () => {
    expect(countParts('500 g gehakt').count).toBe(1);
    expect(countParts('50 g gehakt').count).toBe(1);
    expect(countParts('2 el olijfolie').count).toBe(1);
    expect(withCount('50 g gehakt', 2)).toBe('2× 50 g gehakt');
    expect(countParts('1,5 kg aardappelen').count).toBe(1);
    expect(countParts('Kipfilet (500g)').count).toBe(1);
  });

  it('schrijft een kaal aantal voor de naam, en haalt het weg bij 1', () => {
    expect(withCount('bananen', 3)).toBe('3 bananen');
    expect(withCount('3 bananen', 4)).toBe('4 bananen');
    expect(withCount('3 bananen', 1)).toBe('bananen');
  });

  it('verbuigt verpakkingen mee', () => {
    expect(withCount('1 fles sojasaus', 2)).toBe('2 flessen sojasaus');
    expect(withCount('2 flessen sojasaus', 1)).toBe('1 fles sojasaus');
    expect(withCount('1 st. citroen', 3)).toBe('3 stuks citroen');
  });

  it('zet × voor een naam met gewicht', () => {
    expect(withCount('Kipfilet (500g)', 2)).toBe('2× Kipfilet (500g)');
    expect(withCount('500 g gehakt', 3)).toBe('3× 500 g gehakt');
    expect(withCount('2× Kipfilet (500g)', 1)).toBe('Kipfilet (500g)');
  });

  it('blijft tussen 1 en 99', () => {
    expect(withCount('bananen', 0)).toBe('bananen');
    expect(withCount('bananen', 250)).toBe('99 bananen');
  });

  it('gebruikt het aantal pakken als er een AH-product is', () => {
    expect(itemCount({ name: '6 bananen', ahProduct: ah(2) })).toBe(2);
    expect(countLabel({ name: '6 bananen', ahProduct: ah(2) })).toBe('2×');
    expect(countLabel({ name: '3 flessen cola', ahProduct: null })).toBe('3 flessen');
    expect(countLabel({ name: 'melk', ahProduct: null })).toBe('1×');
  });

  it('splitAmount begrijpt het ×-voorvoegsel', () => {
    expect(splitAmount('2× Kipfilet (500g)')).toEqual({ name: 'Kipfilet', amount: '2× 500 g' });
    expect(splitAmount('2x melk')).toEqual({ name: 'melk', amount: '2×' });
    expect(splitAmount('2 xl eieren').name).toBe('xl eieren');
  });
});
