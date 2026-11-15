import { describe, expect, it } from 'vitest';
import { clubUrl, initialen, leesCode, toonCode } from './cartClub';

describe('cartClub', () => {
  it('toont de code als drie blokjes van vier', () => {
    expect(toonCode('7f3a9c1b04de')).toBe('7F3A-9C1B-04DE');
  });

  it('leest een getypte code met of zonder streepje of spaties', () => {
    expect(leesCode('7F3A-9C1B-04DE')).toBe('7f3a9c1b04de');
    expect(leesCode(' 7f3a 9c1b 04de ')).toBe('7f3a9c1b04de');
    expect(leesCode('7f3a9c1b04de')).toBe('7f3a9c1b04de');
  });

  it('leest de code uit een geplakte link', () => {
    expect(leesCode('https://couplecart.nl/#/shared/7f3a9c1b04de')).toBe('7f3a9c1b04de');
  });

  it('weigert iets dat geen code kan zijn', () => {
    expect(leesCode('')).toBeNull();
    expect(leesCode('7F3A')).toBeNull();
    expect(leesCode('7F3A-9C1B')).toBeNull();
    expect(leesCode('7F3A-9C1B-04DE-00')).toBeNull();
  });

  it('maakt de link waar leesCode weer de code uit haalt', () => {
    expect(leesCode(clubUrl('7f3a9c1b04de', 'https://x.nl'))).toBe('7f3a9c1b04de');
  });

  it('maakt initialen voor het rondje', () => {
    expect(initialen('Sanne de Vries')).toBe('SV');
    expect(initialen('noor')).toBe('NO');
    expect(initialen('luuk.loohuis')).toBe('LL');
    expect(initialen(null)).toBe('');
  });
});
