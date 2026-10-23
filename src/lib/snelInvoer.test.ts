import { describe, expect, it } from 'vitest';
import { splitsInvoer } from '@/lib/snelInvoer';

describe('splitsInvoer', () => {
  it('maakt van één zin losse boodschappen, zonder wanneer', () => {
    expect(splitsInvoer('2 melk, eieren en brood voor zaterdag')).toEqual(['2 melk', 'eieren', 'brood']);
  });

  it('verstaat ingesproken getallen en zinnen zonder komma', () => {
    expect(splitsInvoer('twee melk eieren en brood')).toEqual(['2 melk', 'eieren', 'brood']);
    expect(splitsInvoer('een komkommer en drie paprika')).toEqual(['komkommer', '3 paprika']);
  });

  it('laat namen van meer woorden heel', () => {
    expect(splitsInvoer('halfvolle melk en volkoren brood')).toEqual(['halfvolle melk', 'volkoren brood']);
    expect(splitsInvoer('pindakaas')).toEqual(['pindakaas']);
  });

  it('haalt aanloop, 2x en dubbele weg', () => {
    expect(splitsInvoer('we hebben nog nodig: 2x cola, chips, cola')).toEqual(['2 cola', 'chips']);
    expect(splitsInvoer('zet op de lijst: bananen; appels\nkaas.')).toEqual(['bananen', 'appels', 'kaas']);
    expect(splitsInvoer('3 flessen cola voor morgen')).toEqual(['3 flessen cola']);
  });

  it('geeft niets bij lege invoer', () => {
    expect(splitsInvoer('  ,  en ')).toEqual([]);
  });
});
