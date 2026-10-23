import { knownDepartment } from '@/lib/storeRouteSort';
import { countParts, withCount } from '@/lib/itemCount';
import { VASTE_WINKELS, winkelNaam } from '@/lib/winkels';

/**
 * Eén zin, meerdere boodschappen: "2 melk, eieren en brood voor zaterdag"
 * wordt "2 melk", "eieren", "brood". Getypt of ingesproken; ingesproken tekst
 * heeft vaak geen komma's ("twee melk eieren en brood"), dus gesproken
 * getallen worden cijfers en losse bekende woorden worden losse boodschappen.
 */

const MAX_ITEMS = 30;
const MAX_NAME = 80;

const GETALLEN: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8,
  negen: 9, tien: 10, elf: 11, twaalf: 12, vijftien: 15, twintig: 20,
};

const DAGEN = 'maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|morgen|overmorgen|vandaag|vanavond|straks|het weekend|dit weekend|volgende week';
// "… voor zaterdag", "… voor morgenavond": wanneer, niet wat.
const WANNEER = new RegExp(`\\s+(?:voor|op|tegen|uiterlijk)\\s+(?:${DAGEN})\\w*(?:\\s.*)?$`, 'i');
const WANNEER_LOS = new RegExp(`^(?:${DAGEN})\\w*$`, 'i');

// Wat je ervoor zegt maar niet op de lijst hoort.
const AANLOOP = /^(?:(?:zet|doe)\s+(?:even\s+)?(?:op\s+de\s+lijst|erbij)\s*:?\s*|(?:we|ik)\s+(?:moeten|moet|hebben|heb)\s+(?:nog\s+)?(?:nodig\s*:?\s*)?|nog\s+)/i;
const UITLOOP = /\s+(?:op\s+de\s+lijst|erbij|graag|nodig|halen|kopen)\s*\.?$/i;

// Woorden die iets over het product zeggen: "volkoren brood" is één boodschap.
const SOORT = new Set([
  'volkoren', 'halfvolle', 'volle', 'magere', 'mager', 'bruin', 'bruine', 'wit', 'witte', 'vers', 'verse',
  'gerookte', 'rode', 'groene', 'gele', 'zoete', 'griekse', 'biologische', 'bio', 'light', 'zero', 'grote',
  'kleine', 'gesneden', 'geraspte', 'jonge', 'oude', 'belegen', 'diepvries', 'gehakte', 'gemalen', 'zure',
]);

const SCHEIDING = /\s*(?:[,;\n]|\s(?:en|plus|&|\+)\s)\s*/i;

const schoon = (deel: string) => deel
  .replace(/^[\s\-•*·]+/, '')
  .replace(/[.!?]+$/, '')
  .replace(/^(?:nog|ook|wat|wat\s+extra|extra)\s+/i, '')
  .replace(/\s+/g, ' ')
  .trim();

/** "twee melk" → "2 melk", "2x melk" → "2 melk", "een brood" → "brood". */
const metCijfer = (deel: string): string => {
  const woord = deel.match(/^(\S+)\s+(.+)$/);
  const getal = woord ? GETALLEN[woord[1].toLowerCase()] : undefined;
  if (woord && getal) return getal === 1 ? woord[2] : withCount(woord[2], getal);
  const keer = deel.match(/^(\d{1,2})\s*[x×]\s*(.+)$/i);
  if (keer) return withCount(keer[2], Number(keer[1]));
  return deel;
};

/**
 * Ingesproken "melk eieren brood" is één deel zonder komma's. Splitsen mag
 * alleen als elk woord op zich een bekende boodschap is, anders blijft
 * "halfvolle melk" gewoon één boodschap.
 */
const losseWoorden = (deel: string): string[] => {
  const { rest, prefix } = (() => {
    const m = deel.match(/^(\d{1,2})\s+(.+)$/);
    return m ? { prefix: `${m[1]} `, rest: m[2] } : { prefix: '', rest: deel };
  })();
  const woorden = rest.split(' ');
  const losbaar = woorden.every((w) => w.length >= 3 && knownDepartment(w) && !SOORT.has(w.toLowerCase()));
  if (woorden.length < 2 || !losbaar) return [deel];
  // Het getal hoort bij het eerste woord: "2 melk eieren" = "2 melk", "eieren".
  return [`${prefix}${woorden[0]}`, ...woorden.slice(1)];
};

export interface Ingevoerd {
  naam: string;
  /** Genoemde winkel ("shampoo bij Kruidvat", "@action"); undefined = niet genoemd. */
  winkel?: string;
}

const regex = (woord: string) => woord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Haalt "@kruidvat" of "… bij de Kruidvat" van het eind af. Alleen winkels die je kent, anders is "bij" gewoon tekst. */
const winkelUit = (tekst: string, winkels: string[], alleenAanEind = false): { tekst: string; winkel?: string } => {
  const apestaart = tekst.match(alleenAanEind ? /(?:^|\s)@([\p{L}\d'-]+)\s*$/u : /(?:^|\s)@([\p{L}\d'-]+)/u);
  if (apestaart) return { tekst: tekst.replace(apestaart[0], ' ').replace(/\s+/g, ' ').trim(), winkel: winkelNaam(apestaart[1]) };
  const namen = [...winkels].sort((a, b) => b.length - a.length).map(regex).join('|');
  if (!namen) return { tekst };
  const bij = tekst.match(new RegExp(`\\s+(?:bij|van|in|uit)\\s+(?:de\\s+|het\\s+)?(${namen})\\s*$`, 'i'));
  if (bij) return { tekst: tekst.slice(0, bij.index).trim(), winkel: winkelNaam(bij[1]) };
  return { tekst };
};

/**
 * Zin → boodschappen, met winkel als je die noemt. Staat de winkel aan het
 * eind van de zin ("shampoo en tandpasta bij de Kruidvat"), dan geldt hij voor
 * alles in die zin; bij een los deel alleen voor dat deel.
 */
export const leesInvoer = (tekst: string, bekendeWinkels: string[] = []): Ingevoerd[] => {
  const winkels = [...VASTE_WINKELS, ...bekendeWinkels];
  const geheel = tekst.replace(/[ \t]+/g, ' ').trim().replace(AANLOOP, '').replace(UITLOOP, '').replace(WANNEER, '');
  const { tekst: zin, winkel: voorAlles } = winkelUit(geheel, winkels, true);
  const gezien = new Set<string>();
  const uit: Ingevoerd[] = [];
  for (const ruw of zin.split(SCHEIDING)) {
    const { tekst: zonder, winkel } = winkelUit(ruw.replace(WANNEER, '').trim(), winkels);
    const deel = schoon(zonder);
    if (!deel || WANNEER_LOS.test(deel) || /^(?:en|plus|of)$/i.test(deel)) continue;
    for (const los of losseWoorden(metCijfer(deel))) {
      const naam = metCijfer(los).slice(0, MAX_NAME).trim();
      // "2 cola" en later nog eens "cola" is dezelfde boodschap.
      const sleutel = countParts(naam).rest.toLocaleLowerCase('nl');
      if (!naam || gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      const w = winkel ?? voorAlles;
      uit.push(w ? { naam, winkel: w } : { naam });
    }
  }
  return uit.slice(0, MAX_ITEMS);
};

export const splitsInvoer = (tekst: string): string[] => leesInvoer(tekst).map((i) => i.naam);

/** Lijkt dit op meer dan één boodschap? Dan eerst kaartjes ter controle. */
export const isMeerdere = (tekst: string) => splitsInvoer(tekst).length > 1;
