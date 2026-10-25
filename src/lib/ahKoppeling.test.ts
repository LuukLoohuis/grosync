import { describe, expect, it } from 'vitest';
import type { GroceryItem } from '@/types';
import { alsMatch, ANDERE_WINKELS_AAN, KOPPELBAAR, koppelWinkel, productWinkel, teKoppelen } from '@/lib/ahKoppeling';

const regel = (patch: Partial<GroceryItem>): GroceryItem => ({ id: 'a', name: 'passata', checked: false, ...patch });
const product = (store?: 'Jumbo' | 'Dirk') => ({ id: 1, store, title: 'x', unitSize: null, quantity: 1, imageUrl: null, isBonus: false, category: null });
const ALLE = ['AH', 'Jumbo', 'Dirk'] as const;
const ALLEEN_AH = ['AH'] as const;

describe('koppelWinkel', () => {
  it('volgt de schakelaar', () => {
    expect(KOPPELBAAR.length).toBe(ANDERE_WINKELS_AAN ? 3 : 1);
  });

  it('kent alleen AH als de rest uit staat', () => {
    expect(koppelWinkel('ah', ALLEEN_AH)).toBe('AH');
    expect(koppelWinkel('Jumbo', ALLEEN_AH)).toBeNull();
    expect(koppelWinkel('Jumbo', ALLE)).toBe('Jumbo');
    expect(koppelWinkel('Lidl', ALLE)).toBeNull();
    expect(koppelWinkel(null, ALLE)).toBeNull();
  });
});

describe('teKoppelen', () => {
  it('met alleen AH: AH zonder product en nog niet gezocht', () => {
    const items = [
      regel({ id: '1', store: 'AH' }),
      regel({ id: '2', store: 'AH', priceCheckedAt: '2026-10-24' }),
      regel({ id: '3', store: 'AH', ahProduct: product() }),
      regel({ id: '4', store: 'Jumbo' }),
      regel({ id: '5', store: 'AH', checked: true }),
      regel({ id: '6' }),
    ];
    expect(teKoppelen(items, ALLEEN_AH).map((i) => i.id)).toEqual(['1']);
  });

  it('met Jumbo en Dirk aan: die ook, en opnieuw als de winkel veranderde', () => {
    const items = [
      regel({ id: '1', store: 'Jumbo' }),
      regel({ id: '2', store: 'Dirk', ahProduct: product('Dirk') }),
      regel({ id: '3', store: 'Jumbo', ahProduct: product() }),
      regel({ id: '4', store: 'AH', ahProduct: product('Jumbo'), priceCheckedAt: '2026-10-24' }),
      regel({ id: '5', store: 'Lidl' }),
    ];
    expect(teKoppelen(items, ALLE).map((i) => i.id)).toEqual(['1', '3', '4']);
  });
});

describe('productWinkel', () => {
  it('een product zonder winkel is van AH', () => {
    expect(productWinkel(regel({ ahProduct: product() }))).toBe('AH');
    expect(productWinkel(regel({ ahProduct: product('Jumbo') }))).toBe('Jumbo');
    expect(productWinkel(regel({}))).toBeNull();
  });
});

describe('alsMatch', () => {
  const alt = { productId: 723887, title: 'Jumbo Passata', unitSize: '500 g', price: 0.65, priceBefore: null, isBonus: false, bonusMechanism: null, imageUrl: null, category: '' };

  it('neemt de link van de functie over, met het aantal uit de naam', () => {
    const m = alsMatch(regel({ name: '2 passata' }), { ...alt, productUrl: 'https://www.jumbo.com/producten/jumbo-passata-723887PAK' }, 'Jumbo');
    expect(m.store).toBe('Jumbo');
    expect(m.productUrl).toBe('https://www.jumbo.com/producten/jumbo-passata-723887PAK');
    expect(m.quantity).toBe(2);
    expect(m.price).toBe(1.3);
  });

  it('bouwt de link zelf voor AH en Dirk als de functie er geen gaf', () => {
    expect(alsMatch(regel({}), alt).productUrl).toBe('https://www.ah.nl/producten/product/wi723887');
    expect(alsMatch(regel({}), alt, 'Dirk').productUrl).toBe('https://www.dirk.nl/boodschappen/x/x/x/723887');
  });
});
