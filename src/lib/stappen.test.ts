import { describe, expect, it } from 'vitest';
import { stapStand, type Stap } from './stappen';

const stappen: Stap[] = [
  { label: 'a', ms: 1000 },
  { label: 'b', ms: 2000 },
  { label: 'c', ms: 3000 },
];

describe('stapStand', () => {
  it('begint bij de eerste stap', () => {
    expect(stapStand(stappen, 0)).toEqual({ index: 0, deel: 0 });
  });

  it('schuift door naar de volgende stap na zijn duur', () => {
    expect(stapStand(stappen, 500)).toEqual({ index: 0, deel: 0.5 });
    expect(stapStand(stappen, 2000)).toEqual({ index: 1, deel: 0.5 });
  });

  it('blijft op de laatste stap en komt nooit op vol', () => {
    const lang = stapStand(stappen, 600_000);
    expect(lang.index).toBe(2);
    expect(lang.deel < 0.9 + 1e-9).toBe(true);
    expect(lang.deel > 0.89).toBe(true);
  });

  it('loopt op de laatste stap alleen vooruit', () => {
    expect(stapStand(stappen, 4000).deel < stapStand(stappen, 6000).deel).toBe(true);
  });

  it('is af als het antwoord er is', () => {
    expect(stapStand(stappen, 10, true)).toEqual({ index: 3, deel: 1 });
  });

  it('kan zonder stappen', () => {
    expect(stapStand([], 1000)).toEqual({ index: 0, deel: 0 });
  });
});
