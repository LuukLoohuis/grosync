import { describe, expect, it } from 'vitest';
import { huiskleur, voorWinkel, winkelNaam, winkelsOpLijst, zonderWinkel } from '@/lib/winkels';

const item = (name: string, store: string | null, checked = false) => ({ name, store, checked });

describe('winkels', () => {
  it('maakt een getypte winkel netjes', () => {
    expect(winkelNaam(' ah ')).toBe('AH');
    expect(winkelNaam('kruidvat')).toBe('Kruidvat');
    expect(winkelNaam('bakker  om de hoek')).toBe('Bakker om de hoek');
    expect(winkelNaam('Albert Heijn')).toBe('AH');
    expect(winkelNaam('lidl')).toBe('Lidl');
  });

  it('noemt elke winkel op de open lijst één keer, vaste eerst', () => {
    const lijst = [item('a', 'bakker'), item('b', 'Action'), item('c', 'action'), item('d', 'AH'), item('e', null), item('f', 'Markt', true)];
    expect(winkelsOpLijst(lijst)).toEqual(['AH', 'Action', 'Bakker']);
  });

  it('laat in een winkel zien wat daar hoort en wat overal kan', () => {
    const lijst = [item('shampoo', 'Kruidvat'), item('melk', 'AH'), item('brood', null)];
    expect(voorWinkel(lijst, 'kruidvat').map((i) => i.name)).toEqual(['shampoo', 'brood']);
    expect(voorWinkel(lijst, null).length).toBe(3);
  });

  it('geeft supermarkten hun huiskleur', () => {
    expect(huiskleur('ah')).toContain('bg-[#0089CF]');
    expect(huiskleur('Dirk')).toContain('bg-[#E30613]');
    expect(huiskleur('Kruidvat')).toBe(null);
    expect(huiskleur(null)).toBe(null);
  });

  it('haalt de winkel achter de naam weg', () => {
    expect(zonderWinkel('san marzano Tomaten DOP AH', 'AH')).toBe('san marzano Tomaten DOP');
    expect(zonderWinkel('shampoo bij de Kruidvat', 'Kruidvat')).toBe('shampoo');
    expect(zonderWinkel('Dirk', 'Dirk')).toBe('Dirk');
    expect(zonderWinkel('chai latte', 'AH')).toBe('chai latte');
    expect(zonderWinkel('melk', null)).toBe('melk');
  });
});
