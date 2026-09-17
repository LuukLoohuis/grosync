/**
 * Wat de Bonus-tab de laatste keer vond, in de opslag van deze browser. Het
 * openingsscherm wil weten welke recepten deze week goedkoper zijn, maar mag
 * daarvoor niet zelf acht seconden gaan wachten; dit is wat Bonuschef achterliet.
 */
export interface BonusGeheugen {
  /** Hoeveel aanbiedingen er langs de recepten gingen. */
  aanbiedingen: number;
  /** Wat alle treffers samen scheelden. */
  voordeel: number;
  /** Per recept: hoeveel het scheelt, voor de rijen op het openingsscherm. */
  recepten: { id: string; naam: string; voordeel: number; treffers: number }[];
  /** Tot wanneer deze aanbiedingen lopen; daarna zegt het niets meer. */
  tot: string | null;
  /** Wanneer dit opgeschreven is. */
  op: string;
}

const SLEUTEL = 'bonus-vorige-keer';
// Aanbiedingen wisselen woensdag; na een week is dit hoe dan ook oud nieuws.
const HOUDBAAR_MS = 7 * 24 * 60 * 60 * 1000;

export const leesBonusGeheugen = (): BonusGeheugen | null => {
  try {
    const rauw = localStorage.getItem(SLEUTEL);
    if (!rauw) return null;
    const waarde = JSON.parse(rauw) as BonusGeheugen;
    if (!waarde.op || Date.now() - new Date(waarde.op).getTime() > HOUDBAAR_MS) return null;
    if (waarde.tot && new Date(waarde.tot).getTime() < Date.now() - 86_400_000) return null;
    return { ...waarde, recepten: waarde.recepten ?? [] };
  } catch {
    return null;
  }
};

export const schrijfBonusGeheugen = (waarde: Omit<BonusGeheugen, 'op'>) => {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify({ ...waarde, op: new Date().toISOString() }));
  } catch {
    // Privémodus of volle opslag: dan mist het openingsscherm alleen deze regel.
  }
};
