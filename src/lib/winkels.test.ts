import { describe, expect, it } from 'vitest';
import { voorWinkel, winkelNaam, winkelsOpLijst } from '@/lib/winkels';

const item = (name: string, store: string | null, checked = false) => ({ name, store, checked });

describe('winkels', () => {
  it('maakt een getypte winkel netjes', () => {
    expect(winkelNaam(' ah ')).toBe('AH');
    expect(winkelNaam('kruidvat')).toBe('Kruidvat');
    expect(winkelNaam('bakker  om de hoek')).toBe('Bakker om de hoek');
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
});
