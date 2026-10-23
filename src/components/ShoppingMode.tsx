import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SwipeToCheck from '@/components/SwipeToCheck';
import ItemThumb from '@/components/ItemThumb';
import { CheckCircle, Wegvinken } from '@/components/CheckOff';
import { tik } from '@/lib/haptics';
import { stuurMelding } from '@/lib/meldingen';
import { splitAmount } from '@/lib/itemAmount';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { voorWinkel, winkelsOpLijst, zelfdeWinkel } from '@/lib/winkels';
import type { GroceryItem } from '@/types';
import { t } from '@/lib/i18n';

// Acht vonkjes rond het vinkje als alles gehaald is.
const VONKEN = [0, 45, 90, 135, 180, 225, 270, 315];

// De winkel van de vorige keer: vaak sta je weer in dezelfde.
const WINKEL_KEY = 'couplecart-winkel';
const leesWinkel = () => { try { return localStorage.getItem(WINKEL_KEY); } catch { return null; } };
const bewaarWinkel = (winkel: string | null) => {
  try {
    if (winkel) localStorage.setItem(WINKEL_KEY, winkel); else localStorage.removeItem(WINKEL_KEY);
  } catch { /* geblokkeerd; dan kies je hem de volgende keer opnieuw */ }
};

interface ShoppingModeProps {
  items: GroceryItem[];
  /** Regels die net zijn afgevinkt en nog dichtklappen. */
  weg: ReadonlySet<string>;
  onCheck: (item: GroceryItem) => void;
  onClose: () => void;
  /** Gekozen op de lijst; anders de winkel van de vorige keer. */
  startWinkel?: string | null;
}

/**
 * Boodschappen doen: één afdeling tegelijk, grote regels, en verder niets. Het
 * scherm blijft aan zolang je bezig bent, want je loopt met je telefoon in je
 * hand door de winkel.
 */
const ShoppingMode = ({ items, weg, onCheck, onClose, startWinkel }: ShoppingModeProps) => {
  const [index, setIndex] = useState(0);

  // Eén lijst, meerdere winkels: in de Kruidvat zie je wat daar hoort plus
  // wat overal kan; de rest blijft gewoon op de lijst staan.
  const winkels = useMemo(() => winkelsOpLijst(items), [items]);
  const [winkel, setWinkel] = useState<string | null>(() => {
    const vorige = startWinkel ?? leesWinkel();
    return winkelsOpLijst(items).find((w) => zelfdeWinkel(w, vorige)) ?? null;
  });
  const hier = useMemo(() => voorWinkel(items, winkel), [items, winkel]);
  const elders = items.filter((i) => !i.checked).length - hier.filter((i) => !i.checked).length;

  const groups = useMemo(() => sortByStoreRoute(hier.filter((i) => !i.checked)), [hier]);
  // De afdelingen die er bij het starten waren blijven staan, ook als je ze
  // leegvinkt: anders springt de winkel onder je handen weg.
  const [route, setRoute] = useState(() => groups.map((g) => g.category));

  useEffect(() => {
    setRoute((prev) => {
      const nieuw = groups.map((g) => g.category).filter((c) => !prev.includes(c));
      return nieuw.length > 0 ? [...prev, ...nieuw] : prev;
    });
  }, [groups]);

  // Pas bij de eerste afgevinkte boodschap ben je echt aan het winkelen (niet
  // als je alleen even kijkt); bij het sluiten weten de anderen wat er binnen is.
  const gehaald = useRef(0);
  const vinkAf = (item: GroceryItem) => {
    if (weg.has(item.id)) return;
    if (gehaald.current === 0) stuurMelding('winkel');
    gehaald.current += 1;
    onCheck(item);
  };
  useEffect(() => () => {
    if (gehaald.current > 0) stuurMelding('klaar', { aantal: gehaald.current });
  }, []);

  // Scherm aanhouden zolang je in de winkel staat; niet elke browser kan dit.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((granted) => { lock = granted; }).catch(() => { /* mag geweigerd worden */ });
    return () => { void lock?.release().catch(() => { /* al vrijgegeven */ }); };
  }, []);

  const kiesWinkel = (w: string | null) => {
    if (w === winkel) return;
    setWinkel(w);
    bewaarWinkel(w);
    // Andere winkel, andere route: opnieuw bij de eerste afdeling beginnen.
    setRoute(sortByStoreRoute(voorWinkel(items, w).filter((i) => !i.checked)).map((g) => g.category));
    setIndex(0);
    wasBezig.current = false;
  };

  const huidig = route[index];
  const groep = groups.find((g) => g.category === huidig);
  const teGaan = hier.filter((i) => !i.checked).length;
  const klaar = teGaan === 0;

  // Alleen als je het zelf leeg vinkt, niet als je de winkelmodus opent met alles al in de kar.
  const wasBezig = useRef(!klaar);
  const [feest, setFeest] = useState(false);
  useEffect(() => {
    if (klaar && wasBezig.current) {
      setFeest(true);
      tik('feest');
    }
    wasBezig.current = !klaar;
  }, [klaar]);

  const volgende = () => setIndex((n) => Math.min(n + 1, route.length - 1));
  const laatste = index >= route.length - 1;

  // Buiten de lijst hangen, zodat niets van het scherm eronder meedoet.
  return createPortal(
    <div className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background">
      <header className="shrink-0 bg-primary px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
              {klaar ? (winkel ? t("Alles gehaald bij {0}", [winkel]) : t("Alles gehaald")) : groep?.label ?? t("Klaar met deze afdeling")}
            </h1>
            <p className="mt-0.5 text-sm text-primary-muted">
              {klaar
                ? t("Je kar is compleet.")
                : t("Afdeling {0} van {1} · nog {2} hier", [Math.min(index + 1, route.length), route.length, groep?.items.length ?? 0])}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Winkelmodus sluiten")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-muted hover:bg-primary-deep hover:text-primary-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {winkels.length > 0 && (
          <div role="radiogroup" aria-label={t("Waar ben je?")} className="mx-auto -mb-1 mt-3 flex max-w-lg gap-2 overflow-x-auto pb-1">
            {[null, ...winkels].map((w) => {
              const aan = w === winkel;
              return (
                <button
                  key={w ?? ''}
                  type="button"
                  role="radio"
                  aria-checked={aan}
                  onClick={() => kiesWinkel(w)}
                  className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
                    aan ? 'bg-primary-foreground text-primary' : 'bg-primary-deep text-primary-muted hover:text-primary-foreground'
                  }`}
                >
                  {w ?? t("Alle winkels")}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-2">
          {klaar && (
            <div className="rounded-[14px] border border-border bg-card p-6 text-center">
              <span aria-hidden="true" className="relative mx-auto flex h-12 w-12 items-center justify-center">
                {feest && VONKEN.map((hoek, i) => (
                  <span
                    key={hoek}
                    className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full animate-feest-vonk ${i % 2 ? 'bg-accent' : 'bg-primary'}`}
                    style={{ '--hoek': `${hoek}deg` } as CSSProperties}
                  />
                ))}
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${feest ? 'bg-primary text-primary-foreground animate-feest-pop' : 'bg-primary-soft text-primary'}`}>
                  <Check className="h-6 w-6" strokeWidth={2.4} />
                </span>
              </span>
              <p className="mt-3 font-display text-lg font-bold text-foreground">{t("Niets meer te halen")}</p>
              {elders > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {elders === 1 ? t("Nog 1 boodschap voor een andere winkel.") : t("Nog {0} boodschappen voor andere winkels.", [elders])}
                </p>
              )}
              <Button className="mt-4 min-h-12 w-full" onClick={onClose}>{t("Terug naar je lijst")}</Button>
            </div>
          )}

          {!klaar && (groep?.items.length ?? 0) === 0 && (
            <div className="rounded-[14px] border border-border bg-card p-6 text-center">
              <p className="font-display text-lg font-bold text-foreground">{t("Deze afdeling is klaar")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('Nog {0} op andere afdelingen.', [teGaan])}</p>
            </div>
          )}

          {groep?.items.map((item) => {
            const { name, amount } = splitAmount(item.name);
            return (
              <Wegvinken key={item.id} weg={weg.has(item.id)}>
              <SwipeToCheck onSwipe={() => vinkAf(item)}>
                <div className="flex min-h-18 items-center gap-2 rounded-[14px] border border-border bg-card py-2 pl-1 pr-4">
                  <button
                    onClick={() => vinkAf(item)}
                    aria-label={t("Vink {0} af", [item.name])}
                    className="group/check flex h-14 w-14 shrink-0 items-center justify-center"
                  >
                    <CheckCircle on={weg.has(item.id)} large />
                  </button>
                  <ItemThumb item={item} label={name} className="h-14 w-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold tracking-[-0.01em] text-foreground">{name}</span>
                    {item.note && <span className="block text-sm leading-snug text-foreground/80">{item.note}</span>}
                    {!winkel && item.store && <span className="block text-xs font-semibold text-muted-foreground">{item.store}</span>}
                    {item.fromRecipe && <span className="block truncate text-xs text-accent-ink">uit {item.fromRecipe}</span>}
                  </span>
                  {amount && <span className="shrink-0 text-[0.9375rem] tabular-nums text-muted-foreground">{amount}</span>}
                </div>
              </SwipeToCheck>
              </Wegvinken>
            );
          })}
        </div>
      </div>

      {!klaar && (
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("Veeg naar rechts om af te vinken")}</p>
            <Button
              variant="secondary"
              className="min-h-12 shrink-0 gap-2"
              onClick={laatste ? onClose : volgende}
            >
              {laatste ? t("Afronden") : t("Volgende afdeling")} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>,
    document.body,
  );
};

export default ShoppingMode;
