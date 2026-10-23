import { useState } from 'react';
import { ArrowRight, BellRing, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useMeldStatus } from '@/hooks/useMeldStatus';
import { t } from '@/lib/i18n';

const WEG_KEY = 'couplecart-meldkaart-weg';

const leesWeg = () => {
  try { return localStorage.getItem(WEG_KEY) === '1'; } catch { return false; }
};

/**
 * Eén keer op "Vandaag", pas als er iemand anders in je Cart Club zit: vraag
 * om meldingen op het moment dat ze iets opleveren, nooit bij de eerste start.
 */
const MeldingenKaart = () => {
  const { household } = useAppContext();
  const { status, bezig, aan } = useMeldStatus();
  const [weg, setWeg] = useState(leesWeg);

  if (weg || household.rol === 'geen' || status !== 'uit') return null;

  const verberg = () => {
    setWeg(true);
    try { localStorage.setItem(WEG_KEY, '1'); } catch { /* dan alleen deze keer */ }
  };

  return (
    <section className="relative rounded-[14px] border border-border bg-card p-3.5 pr-12 animate-fade-in">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[1.0625rem] font-bold leading-snug text-foreground">{t("Krijg een seintje")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("Als de ander iets op de lijst zet of in de winkel staat. Niet 's nachts, en nooit over wat je zelf doet.")}
          </p>
          <button
            type="button"
            disabled={bezig}
            onClick={() => { void aan().then((nieuw) => { if (nieuw === 'geweigerd') verberg(); }); }}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {t("Zet meldingen aan")} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={verberg}
        aria-label={t("Niet nu")}
        title={t("Niet nu")}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
};

export default MeldingenKaart;
