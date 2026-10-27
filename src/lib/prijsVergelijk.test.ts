import { describe, expect, it } from 'vitest';
import { besparing, keuzesVan, meerDanGoedkoopste, overalGevonden } from './prijsVergelijk';
import type { VergelijkKeuze, WinkelTotaal } from '@/services/ahApi';

const winkel = (store: WinkelTotaal['store'], eerlijkTotaal: number, ontbreekt: string[] = []): WinkelTotaal => ({
  store, totaal: eerlijkTotaal, eerlijkTotaal, bonusVoordeel: 0, gevonden: 3 - ontbreekt.length, ontbreekt,
});

describe('prijsVergelijk', () => {
  it('besparing: goedkoopste tegen duurste', () => {
    expect(besparing([winkel('Dirk', 30.1), winkel('Jumbo', 33), winkel('AH', 36.4)])).toEqual({ store: 'Dirk', bedrag: 6.3, tegen: 'AH' });
  });

  it('besparing: geen verschil of niets vergeleken is null', () => {
    expect(besparing([winkel('AH', 10), winkel('Dirk', 10)])).toBeNull();
    expect(besparing([winkel('AH', 0), winkel('Dirk', 0)])).toBeNull();
    expect(besparing([winkel('AH', 10)])).toBeNull();
  });

  it('meerDanGoedkoopste per winkel', () => {
    const meer = meerDanGoedkoopste([winkel('Dirk', 10), winkel('AH', 12.55)]);
    expect(meer.get('Dirk')).toBe(0);
    expect(meer.get('AH')).toBe(2.55);
  });

  it('overalGevonden telt regels die elke winkel heeft', () => {
    expect(overalGevonden(['a', 'b', 'c'], [winkel('AH', 1), winkel('Dirk', 1, ['b']), winkel('Jumbo', 1, ['c'])])).toBe(1);
  });

  it('keuzesVan in lijstvolgorde, alleen die winkel', () => {
    const k = (store: VergelijkKeuze['store'], itemId: string) => ({ store, itemId }) as VergelijkKeuze;
    expect(keuzesVan('AH', ['a', 'b', 'c'], [k('AH', 'c'), k('Dirk', 'a'), k('AH', 'a')]).map((x) => x.itemId)).toEqual(['a', 'c']);
  });
});
