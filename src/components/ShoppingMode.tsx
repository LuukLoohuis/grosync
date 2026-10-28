import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SwipeToCheck from '@/components/SwipeToCheck';
import ItemRegel from '@/components/ItemRegel';
import { Wegvinken } from '@/components/CheckOff';
import { tik } from '@/lib/haptics';
import { stuurMelding } from '@/lib/meldingen';
import { splitAmount } from '@/lib/itemAmount';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { huiskleur, voorWinkel, winkelsOpLijst, zelfdeWinkel, zonderWinkel } from '@/lib/winkels';
import WinkelLabel, { WinkelStip } from '@/components/WinkelLabel';
import type { GroceryItem } from '@/types';
import { t } from '@/lib/i18n';

// Acht vonkjes rond het vinkje als alles gehaald is.
const VONKEN = [0, 45, 90, 135, 180, 225, 270, 315];
// Vanaf zoveel boodschappen te gaan zegt de onderbalk "bijna".
const BIJNA = 3;

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

  // Zelfde idee voor de voortgang: wat open stond toen je begon, plus wat
  // er onderweg bij komt. Zo telt de balk alleen deze ronde, niet wat er
  // van de vorige keer nog afgevinkt op de lijst staat.
  const [ronde, setRonde] = useState(() => new Set(hier.filter((i) => !i.checked).map((i) => i.id)));

  useEffect(() => {
    setRoute((prev) => {
      const nieuw = groups.map((g) => g.category).filter((c) => !prev.includes(c));
      return nieuw.length > 0 ? [...prev, ...nieuw] : prev;
    });
    setRonde((prev) => {
      const nieuw = groups.flatMap((g) => g.items).filter((i) => !prev.has(i.id));
      return nieuw.length > 0 ? new Set([...prev, ...nieuw.map((i) => i.id)]) : prev;
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
    const open = voorWinkel(items, w).filter((i) => !i.checked);
    setRoute(sortByStoreRoute(open).map((g) => g.category));
    setRonde(new Set(open.map((i) => i.id)));
    setIndex(0);
    wasBezig.current = false;
  };

  const huidig = route[index];
  const groep = groups.find((g) => g.category === huidig);
  const teGaan = hier.filter((i) => !i.checked).length;
  const klaar = teGaan === 0;
  // Wat de partner intussen van de lijst haalt, telt niet mee.
  const inRonde = hier.filter((i) => ronde.has(i.id));
  const gedaan = inRonde.filter((i) => i.checked || weg.has(i.id)).length;
  const deel = inRonde.length > 0 ? gedaan / inRonde.length : 1;

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

  // Van welke kant de afdeling binnenkomt: vooruit door de winkel, of een gangpad terug.
  const [richting, setRichting] = useState<'vooruit' | 'terug' | null>(null);
  const volgende = () => { setRichting('vooruit'); setIndex((n) => Math.min(n + 1, route.length - 1)); };
  const vorige = () => { setRichting('terug'); setIndex((n) => Math.max(n - 1, 0)); };
  const laatste = index >= route.length - 1;

  // Afronden met nog iets open: eerst zeggen wat er blijft liggen, niet stil sluiten.
  const [afronden, setAfronden] = useState(false);
  const blijftOpen = hier.filter((i) => !i.checked && !weg.has(i.id));
  const rondAf = () => (blijftOpen.length > 0 ? setAfronden(true) : onClose());
  const terugNaarOpen = () => {
    const eerste = route.findIndex((c) => groups.some((g) => g.category === c && g.items.length > 0));
    setAfronden(false);
    setRichting('terug');
    setIndex(Math.max(eerste, 0));
  };

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
            {inRonde.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label={t("Gehaald")}
                  aria-valuemin={0}
                  aria-valuemax={inRonde.length}
                  aria-valuenow={gedaan}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-primary-deep"
                >
                  <div
                    className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-smooth"
                    style={{ transform: `scaleX(${deel})` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-primary-foreground">{gedaan}/{inRonde.length}</span>
              </div>
            )}
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
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
                    aan ? (huiskleur(w) ?? 'bg-primary-foreground text-primary') : 'bg-primary-deep text-primary-muted hover:text-primary-foreground'
                  }`}
                >
                  {!aan && <WinkelStip winkel={w} />}
                  {w ?? t("Alle winkels")}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* Nieuwe sleutel per afdeling, zodat hij van de goede kant binnenschuift. */}
        <div
          key={huidig ?? 'klaar'}
          className={`mx-auto max-w-lg space-y-2 ${richting === 'vooruit' ? 'animate-tab-in-right' : richting === 'terug' ? 'animate-tab-in-left' : ''}`}
        >
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
            const { name, amount } = splitAmount(zonderWinkel(item.name, item.store));
            return (
              <Wegvinken key={item.id} weg={weg.has(item.id)}>
              <SwipeToCheck onSwipe={() => vinkAf(item)}>
                <ItemRegel
                  item={item}
                  naam={name}
                  groot
                  af={weg.has(item.id)}
                  onVinkAf={() => vinkAf(item)}
                  onder={<>
                    {item.note && <span className="block text-sm leading-snug text-foreground/80">{item.note}</span>}
                    {!winkel && item.store && <WinkelLabel winkel={item.store} className="mt-0.5 inline-block" />}
                    {item.fromRecipe && <span className="block truncate text-xs text-accent-ink">uit {item.fromRecipe}</span>}
                  </>}
                  rechts={amount && <span className="shrink-0 pr-2.5 text-[0.9375rem] tabular-nums text-muted-foreground">{amount}</span>}
                  className="rounded-[14px] border border-border bg-card"
                />
              </SwipeToCheck>
              </Wegvinken>
            );
          })}
        </div>
      </div>

      {!klaar && afronden && (
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-smooth">
          <div className="mx-auto max-w-lg">
            <p className="text-sm font-semibold text-foreground">
              {blijftOpen.length === 1 ? t("Nog 1 niet gehaald") : t("Nog {0} niet gehaald", [blijftOpen.length])}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {blijftOpen.map((i) => splitAmount(zonderWinkel(i.name, i.store)).name).join(', ')}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="min-h-12 flex-1" onClick={terugNaarOpen}>{t("Terug de winkel in")}</Button>
              <Button variant="secondary" className="min-h-12 flex-1" onClick={onClose}>{t("Laten staan")}</Button>
            </div>
          </div>
        </footer>
      )}

      {!klaar && !afronden && (
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" className="min-h-12 w-12 shrink-0 px-0" onClick={vorige} aria-label={t("Vorige afdeling")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {teGaan <= BIJNA ? (
              <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                {teGaan === 1 ? t("Bijna klaar, nog 1!") : t("Bijna klaar, nog {0}!", [teGaan])}
              </p>
            ) : (
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("Veeg naar rechts om af te vinken")}</p>
            )}
            <Button
              variant="secondary"
              className="min-h-12 shrink-0 gap-2"
              onClick={laatste ? rondAf : volgende}
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
