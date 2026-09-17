import { EN } from '@/lib/en';

export type Taal = 'nl' | 'en';

const SLEUTEL = 'couplecart-taal';

const lees = (): Taal => {
  try {
    const bewaard = localStorage.getItem(SLEUTEL);
    if (bewaard === 'en' || bewaard === 'nl') return bewaard;
  } catch {
    // Geen opslag: dan de taal van de browser.
  }
  return typeof navigator !== 'undefined' && /^en\b/i.test(navigator.language) ? 'en' : 'nl';
};

// Eén keer bij het laden gelezen. Wisselen herlaadt de pagina, zodat elke tekst
// — ook die buiten React, in toasts en labels — in één keer omgaat.
let huidige: Taal = lees();

export const taal = (): Taal => huidige;
export const locale = () => (huidige === 'en' ? 'en-GB' : 'nl-NL');

export const setTaal = (nieuw: Taal) => {
  if (nieuw === huidige) return;
  try {
    localStorage.setItem(SLEUTEL, nieuw);
  } catch {
    // Zonder opslag geldt de keuze tot de volgende keer laden.
  }
  huidige = nieuw;
  document.documentElement.lang = nieuw;
  window.location.reload();
};

if (typeof document !== 'undefined') document.documentElement.lang = huidige;

/**
 * Vertaalt een Nederlandse tekst. De Nederlandse tekst is de sleutel: staat hij
 * niet in het Engelse woordenboek, dan blijft hij Nederlands — liever dat dan
 * een lege plek. Plaatshouders: `{0}`, `{1}` bij een rij, `{naam}` bij een object.
 */
export const t = (tekst: string, vars?: unknown[] | Record<string, unknown>): string => {
  const vertaald = huidige === 'en' ? (EN[tekst] ?? tekst) : tekst;
  if (!vars) return vertaald;
  return vertaald.replace(/\{(\w+)\}/g, (heel, naam: string) => {
    const waarde = Array.isArray(vars) ? vars[Number(naam)] : vars[naam];
    return waarde === undefined || waarde === null ? heel : String(waarde);
  });
};
