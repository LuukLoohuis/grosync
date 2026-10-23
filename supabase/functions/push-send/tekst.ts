// Wat er in een melding staat en wanneer er niets gestuurd wordt. Los van
// index.ts, zodat het zonder netwerk te testen is (deno test).

export const SOORTEN = ['toegevoegd', 'winkel', 'klaar', 'voorraad', 'club'] as const;
export type Soort = typeof SOORTEN[number];

export const isSoort = (waarde: unknown): waarde is Soort =>
  typeof waarde === 'string' && (SOORTEN as readonly string[]).includes(waarde);

export interface Gebeurtenis {
  soort: Soort;
  /** Wat er op de lijst kwam, of welk product op is. */
  namen?: string[];
  /** Hoeveel er gehaald is bij 'klaar'. */
  aantal?: number;
}

export interface Bericht {
  title: string;
  body: string;
  soort: Soort;
  /** De tab die opengaat als je op de melding tikt. */
  tab: 'list' | 'pantry';
}

const MAX_NAMEN = 20;
const MAX_LENGTE = 60;

/** Alleen korte, echte namen; de rest van de tekst maakt de server zelf. */
export const schoneNamen = (namen: unknown): string[] =>
  (Array.isArray(namen) ? namen : [])
    .filter((naam): naam is string => typeof naam === 'string')
    .map((naam) => naam.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTE))
    .filter(Boolean)
    .slice(0, MAX_NAMEN);

const opsomming = (namen: string[], max = 4) => {
  const getoond = namen.slice(0, max);
  const rest = namen.length - getoond.length;
  if (rest > 0) return `${getoond.join(', ')} en nog ${rest}`;
  if (getoond.length <= 1) return getoond.join('');
  return `${getoond.slice(0, -1).join(', ')} en ${getoond[getoond.length - 1]}`;
};

export function bericht({ soort, namen = [], aantal }: Gebeurtenis, afzender: string | null): Bericht {
  const wie = afzender?.trim() || 'Iemand uit je Cart Club';
  switch (soort) {
    case 'toegevoegd':
      return namen.length <= 1
        ? { soort, tab: 'list', title: `${wie} zette ${namen[0] ?? 'iets'} op de lijst`, body: 'Tik om de lijst te zien.' }
        : { soort, tab: 'list', title: `${wie} zette ${namen.length} dingen op de lijst`, body: opsomming(namen) };
    case 'winkel':
      return { soort, tab: 'list', title: `${wie} is boodschappen aan het doen`, body: 'Nog iets nodig? Zet het nu op de lijst.' };
    case 'klaar':
      return {
        soort,
        tab: 'list',
        title: `${wie} heeft de boodschappen gedaan`,
        body: aantal && aantal > 0 ? (aantal === 1 ? '1 ding gehaald.' : `${aantal} dingen gehaald.`) : 'Alles is binnen.',
      };
    case 'voorraad':
      return { soort, tab: 'pantry', title: `${namen[0] ?? 'Iets'} is op`, body: `${wie} zag het in de voorraad. Op de lijst zetten?` };
    case 'club':
      return { soort, tab: 'list', title: `${wie} zit nu in je Cart Club`, body: 'Jullie zien vanaf nu dezelfde lijst.' };
  }
}

/** Tussen 22:00 en 8:00 in de tijdzone van de ontvanger gaat er niets uit. */
export function stilNu(moment: Date, tijdzone: string): boolean {
  const uur = (zone: string) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: zone }).format(moment));
  let h: number;
  try {
    h = uur(tijdzone);
  } catch {
    h = uur('Europe/Amsterdam');
  }
  return h >= 22 || h < 8;
}
