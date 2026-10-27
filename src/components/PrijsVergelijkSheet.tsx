import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { GroceryItem } from '@/types';
import { comparePrices, VERGELIJK_MAX_ITEMS, type Vergelijking } from '@/services/ahApi';
import { QuotaError } from '@/services/functions';
import { besparing, keuzesVan, meerDanGoedkoopste, overalGevonden } from '@/lib/prijsVergelijk';
import { huiskleur } from '@/lib/winkels';
import { zoekNaam } from '@/lib/ahKoppeling';
import { locale, t } from '@/lib/i18n';

const euro = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' });

interface PrijsVergelijkSheetProps {
  open: boolean;
  /** De open boodschappen; bij het openen vastgelegd, zodat afvinken de uitkomst niet verschuift. */
  items: GroceryItem[];
  onClose: () => void;
  /** Het karretje-tegoed is op. */
  onOverLimit: () => void;
  /** Na elke poging, om de teller te verversen. */
  onKlaar: () => void;
}

type Stand = { soort: 'bezig' } | { soort: 'fout' } | { soort: 'klaar'; uitkomst: Vergelijking };

const eenheidTekst = { kg: 'kg', l: 'l', stuk: 'stuk' } as const;

const PrijsVergelijkSheet = ({ open, items, onClose, onOverLimit, onKlaar }: PrijsVergelijkSheetProps) => {
  const [stand, setStand] = useState<Stand>({ soort: 'bezig' });
  const [uitgeklapt, setUitgeklapt] = useState<string | null>(null);
  const lijst = useRef<GroceryItem[]>([]);
  const poging = useRef(0);

  const vergelijk = async () => {
    const deze = ++poging.current;
    setStand({ soort: 'bezig' });
    try {
      const uitkomst = await comparePrices(lijst.current.map((i) => ({ id: i.id, name: zoekNaam(i) })));
      if (deze === poging.current) setStand({ soort: 'klaar', uitkomst });
    } catch (error) {
      if (deze !== poging.current) return;
      if (error instanceof QuotaError) {
        onClose();
        onOverLimit();
      } else {
        console.error('Prijsvergelijking mislukt:', error);
        setStand({ soort: 'fout' });
      }
    } finally {
      onKlaar();
    }
  };

  useEffect(() => {
    if (!open) {
      poging.current++;
      return;
    }
    lijst.current = items.slice(0, VERGELIJK_MAX_ITEMS);
    setUitgeklapt(null);
    void vergelijk();
    // Alleen bij openen: een nieuwe vergelijking kost een karretje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const naam = (id: string) => lijst.current.find((i) => i.id === id)?.name ?? '';
  const aantal = lijst.current.length;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">
            {t('Waar is je lijst het goedkoopst?')}{' '}
            <span className="ml-1 inline-block rounded-full bg-muted px-2 py-0.5 align-middle font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('beta')}
            </span>
          </SheetTitle>
          <SheetDescription>
            {items.length > VERGELIJK_MAX_ITEMS
              ? t('De eerste {0} van {1} boodschappen, bij AH, Jumbo en Dirk.', [VERGELIJK_MAX_ITEMS, items.length])
              : t('{0} boodschappen, bij AH, Jumbo en Dirk.', [aantal])}
          </SheetDescription>
        </SheetHeader>

        {stand.soort === 'bezig' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('We zoeken bij drie winkels. Dat duurt zo’n halve minuut.')}</p>
          </div>
        )}

        {stand.soort === 'fout' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t('Vergelijken lukte niet. Controleer je verbinding en probeer het opnieuw.')}</p>
            <Button type="button" variant="outline" onClick={() => void vergelijk()} className="min-h-11 gap-2">
              <RefreshCw className="h-4 w-4" /> {t('Opnieuw proberen')}
            </Button>
          </div>
        )}

        {stand.soort === 'klaar' && (() => {
          const { items: ids, stores, keuzes } = stand.uitkomst;
          const winst = besparing(stores);
          const meer = meerDanGoedkoopste(stores);
          const overal = overalGevonden(ids, stores);
          return (
            <div className="mt-4 space-y-3">
              {winst ? (
                <p className="rounded-[14px] bg-accent-soft px-4 py-3 text-sm text-foreground">
                  {t('Bij {0} ben je {1} goedkoper uit dan bij {2}.', [winst.store, euro.format(winst.bedrag), winst.tegen])}
                </p>
              ) : overal === 0 ? (
                <p className="rounded-[14px] bg-muted px-4 py-3 text-sm text-muted-foreground">
                  {t('Geen boodschap gevonden die alle drie de winkels hebben, dus niets te vergelijken.')}
                </p>
              ) : null}

              {stores.map((winkel, plek) => {
                const open = uitgeklapt === winkel.store;
                const extra = meer.get(winkel.store) ?? 0;
                return (
                  <div key={winkel.store} className={`rounded-[14px] border ${plek === 0 && winst ? 'border-primary' : 'border-border'} bg-card`}>
                    <button
                      type="button"
                      onClick={() => setUitgeklapt(open ? null : winkel.store)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${huiskleur(winkel.store) ?? 'bg-muted text-foreground'}`}>
                        {winkel.store}
                      </span>
                      <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                        <span className="tabular-nums">{t('{0} van {1} gevonden', [winkel.gevonden, ids.length])}</span>
                        {winkel.bonusVoordeel > 0.004 && <> · {t('{0} aanbieding', [euro.format(winkel.bonusVoordeel)])}</>}
                      </span>
                      <span className="text-right leading-tight">
                        <span className="block font-display text-lg font-bold tabular-nums text-foreground">{euro.format(winkel.eerlijkTotaal)}</span>
                        {extra > 0.004 && <span className="block text-[0.6875rem] tabular-nums text-muted-foreground">+{euro.format(extra)}</span>}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="border-t border-border px-4 py-2">
                        <ul className="divide-y divide-border">
                          {keuzesVan(winkel.store, ids, keuzes).map((k) => (
                            <li key={k.itemId} className="flex items-start gap-3 py-2 text-sm">
                              <div className="min-w-0 flex-1">
                                <a href={k.productUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-foreground hover:underline">
                                  {k.quantity > 1 ? `${k.quantity}× ` : ''}{k.title}
                                </a>
                                <p className="truncate text-xs text-muted-foreground">
                                  {naam(k.itemId)}
                                  {k.unitSize && ` · ${k.unitSize}`}
                                  {k.perEenheid && ` · ${t('{0} per {1}', [euro.format(k.perEenheid.prijs), eenheidTekst[k.perEenheid.eenheid]])}`}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="tabular-nums text-foreground">{euro.format(k.price)}</p>
                                {k.isBonus && <p className="text-[0.6875rem] text-accent-ink">{k.bonusMechanism || t('Aanbieding')}</p>}
                              </div>
                            </li>
                          ))}
                        </ul>
                        {winkel.ontbreekt.length > 0 && (
                          <p className="py-2 text-xs text-muted-foreground">
                            {t('Niet gevonden: {0}', [winkel.ontbreekt.map(naam).filter(Boolean).join(', ')])}
                          </p>
                        )}
                        {winkel.totaal - winkel.eerlijkTotaal > 0.004 && (
                          <p className="pb-2 text-xs text-muted-foreground">
                            {t('Met alles wat {0} heeft: {1}', [winkel.store, euro.format(winkel.totaal)])}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="px-1 pb-2 text-xs text-muted-foreground">
                {t('Vergeleken over de {0} boodschappen die alle drie hebben, voor dezelfde hoeveelheid (het kleinste pak), met het goedkoopste passende product en de aanbiedingen van nu.', [overal])}
              </p>
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
};

export default PrijsVergelijkSheet;
