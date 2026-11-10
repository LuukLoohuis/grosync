import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { huiskleur } from '@/lib/winkels';
import { t } from '@/lib/i18n';

interface ZoekVoortgangProps {
  /** Per winkel één regel; ze zoeken tegelijk, niet in hetzelfde tempo. */
  winkels: string[];
  /** De boodschappen in de volgorde waarin de server ze opzoekt. */
  namen: string[];
  /** Het antwoord is binnen: alle regels op vol en een vinkje. */
  klaar: boolean;
  /** Hoe lang de server meestal zoekt; de teller loopt iets voor en wacht dan. */
  zoektijdMs: number;
  /** Wat er na het zoeken nog gebeurt, zolang het antwoord er niet is. */
  slot?: string;
}

/**
 * Wat de server echt doet, zichtbaar gemaakt: per winkel elke boodschap
 * opzoeken en dan het passende product kiezen. De server meldt geen
 * tussenstand, dus de teller is een schatting die nooit vooruitloopt op het
 * antwoord: hij blijft op het slot staan tot de uitkomst er is.
 */
const ZoekVoortgang = ({ winkels, namen, klaar, zoektijdMs, slot }: ZoekVoortgangProps) => {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const begin = performance.now();
    const klok = window.setInterval(() => setMs(performance.now() - begin), 150);
    return () => window.clearInterval(klok);
  }, []);

  const n = namen.length;
  return (
    <ul aria-hidden="true" className="space-y-2">
      {winkels.map((winkel, plek) => {
        const tempo = zoektijdMs * (0.8 + plek * 0.12);
        const gezocht = klaar ? n : Math.min(n, Math.floor((Math.max(0, ms - plek * 250) / tempo) * n));
        const status = klaar ? t('Klaar') : gezocht < n ? t('Zoekt {0}', [namen[gezocht]]) : (slot ?? t('Kiest het goedkoopste…'));
        return (
          <li key={winkel} className="relative overflow-hidden rounded-[14px] border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${huiskleur(winkel) ?? 'bg-muted text-foreground'}`}>{winkel}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{status}</span>
              {klaar
                ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.4} />
                : <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{gezocht}/{n}</span>}
            </div>
            <span
              className="absolute inset-x-0 bottom-0 block h-0.5 origin-left bg-primary transition-transform duration-300 ease-smooth"
              style={{ transform: `scaleX(${n ? gezocht / n : 0})` }}
            />
          </li>
        );
      })}
    </ul>
  );
};

export default ZoekVoortgang;
