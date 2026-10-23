// Korte trillingen bij wat je met je duim doet. Alleen waar de browser het kan
// (Android); Safari op iPhone heeft geen trilmotor voor websites en slaat het over.

export type Tik = 'licht' | 'vink' | 'feest';

const PATROON: Record<Tik, number | number[]> = {
  licht: 8,
  vink: 14,
  feest: [16, 60, 16, 60, 32],
};

export const tik = (soort: Tik = 'licht') => {
  try {
    navigator.vibrate?.(PATROON[soort]);
  } catch {
    // Geen trilmotor, of de browser staat het nu niet toe.
  }
};

/** Wie minder beweging wil, krijgt de regel meteen weg in plaats van na de animatie. */
export const minderBeweging = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
