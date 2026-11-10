/** Eén stap van een lange AI-taak, met hoe lang die meestal duurt. */
export interface Stap {
  label: string;
  ms: number;
}

export interface StapStand {
  /** De stap die nu loopt; de laatste blijft lopen tot het antwoord er is. */
  index: number;
  /** Hoe ver de huidige stap is, 0 tot 1. De laatste stap komt niet verder dan 0,9. */
  deel: number;
}

const LAATSTE_MAX = 0.9;

/**
 * Waar de schatting staat na `ms` milliseconden. De server meldt geen
 * tussenstand, dus dit is tijd, geen echte voortgang: daarom loopt hij nooit
 * voor op het antwoord en blijft hij op de laatste stap staan.
 */
export function stapStand(stappen: Stap[], ms: number, klaar = false): StapStand {
  if (stappen.length === 0) return { index: 0, deel: 0 };
  const laatste = stappen.length - 1;
  if (klaar) return { index: stappen.length, deel: 1 };
  let rest = Math.max(0, ms);
  for (let i = 0; i < laatste; i++) {
    const duur = Math.max(1, stappen[i].ms);
    if (rest < duur) return { index: i, deel: rest / duur };
    rest -= duur;
  }
  // Langzaam naar 90 %: wie lang wacht, ziet nog beweging, maar nooit "af".
  const duur = Math.max(1, stappen[laatste].ms);
  return { index: laatste, deel: LAATSTE_MAX * (1 - Math.exp(-rest / duur)) };
}
