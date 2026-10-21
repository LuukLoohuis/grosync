/**
 * Cart Club: de club van mensen die één CoupleCart delen. De uitnodiging is de
 * share_code van shared_lists (8 tekens, kleine letters). Op het scherm staat
 * hij als twee blokjes van vier in hoofdletters, zodat je hem kunt voorlezen.
 */

export const clubUrl = (code: string, origin = window.location.origin) => `${origin}/#/shared/${code}`;

/** "7f3a9c1b" → "7F3A-9C1B". */
export const toonCode = (code: string) => {
  const c = code.toUpperCase();
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

/**
 * Leest een getypte of geplakte uitnodiging: de code met of zonder streepje of
 * spaties, of de hele link. Geeft de code terug zoals hij in de database staat,
 * of null als het er geen kan zijn.
 */
export const leesCode = (invoer: string): string | null => {
  const uitLink = invoer.match(/\/shared\/([A-Za-z0-9-]+)/);
  const ruw = (uitLink ? uitLink[1] : invoer).toLowerCase().replace(/[\s-]/g, '');
  return /^[0-9a-z]{8}$/.test(ruw) ? ruw : null;
};

/** Twee letters voor het rondje: "Sanne de Vries" → "SV", "noor" → "NO". */
export const initialen = (naam: string | null) => {
  const woorden = (naam ?? '').replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return '';
  if (woorden.length === 1) return woorden[0].slice(0, 2).toUpperCase();
  return (woorden[0][0] + woorden[woorden.length - 1][0]).toUpperCase();
};
