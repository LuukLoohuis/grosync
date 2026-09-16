import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SwipeToCheck from '@/components/SwipeToCheck';
import { splitAmount } from '@/lib/itemAmount';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import type { GroceryItem } from '@/types';

interface ShoppingModeProps {
  items: GroceryItem[];
  onCheck: (item: GroceryItem) => void;
  onClose: () => void;
}

/**
 * Boodschappen doen: één afdeling tegelijk, grote regels, en verder niets. Het
 * scherm blijft aan zolang je bezig bent, want je loopt met je telefoon in je
 * hand door de winkel.
 */
const ShoppingMode = ({ items, onCheck, onClose }: ShoppingModeProps) => {
  const [index, setIndex] = useState(0);

  const groups = useMemo(() => sortByStoreRoute(items.filter((i) => !i.checked)), [items]);
  // De afdelingen die er bij het starten waren blijven staan, ook als je ze
  // leegvinkt: anders springt de winkel onder je handen weg.
  const [route, setRoute] = useState(() => groups.map((g) => g.category));

  useEffect(() => {
    setRoute((prev) => {
      const nieuw = groups.map((g) => g.category).filter((c) => !prev.includes(c));
      return nieuw.length > 0 ? [...prev, ...nieuw] : prev;
    });
  }, [groups]);

  // Scherm aanhouden zolang je in de winkel staat; niet elke browser kan dit.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((granted) => { lock = granted; }).catch(() => { /* mag geweigerd worden */ });
    return () => { void lock?.release().catch(() => { /* al vrijgegeven */ }); };
  }, []);

  const huidig = route[index];
  const groep = groups.find((g) => g.category === huidig);
  const teGaan = items.filter((i) => !i.checked).length;
  const klaar = teGaan === 0;

  const volgende = () => setIndex((n) => Math.min(n + 1, route.length - 1));
  const laatste = index >= route.length - 1;

  // Buiten de lijst hangen, zodat niets van het scherm eronder meedoet.
  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col bg-background">
      <header className="shrink-0 bg-primary px-5 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
              {klaar ? 'Alles gehaald' : groep?.label ?? 'Klaar met deze afdeling'}
            </h1>
            <p className="mt-0.5 text-sm text-primary-muted">
              {klaar
                ? 'Je kar is compleet.'
                : `Afdeling ${Math.min(index + 1, route.length)} van ${route.length} · nog ${groep?.items.length ?? 0} hier`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Winkelmodus sluiten"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-muted hover:bg-primary-deep hover:text-primary-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-2">
          {klaar && (
            <div className="rounded-[14px] border border-border bg-card p-6 text-center">
              <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Check className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <p className="mt-3 font-display text-lg font-bold text-foreground">Niets meer te halen</p>
              <Button className="mt-4 min-h-12 w-full" onClick={onClose}>Terug naar je lijst</Button>
            </div>
          )}

          {!klaar && (groep?.items.length ?? 0) === 0 && (
            <div className="rounded-[14px] border border-border bg-card p-6 text-center">
              <p className="font-display text-lg font-bold text-foreground">Deze afdeling is klaar</p>
              <p className="mt-1 text-sm text-muted-foreground">Nog {teGaan} op andere afdelingen.</p>
            </div>
          )}

          {groep?.items.map((item) => {
            const { name, amount } = splitAmount(item.name);
            return (
              <SwipeToCheck key={item.id} onSwipe={() => onCheck(item)}>
                <div className="flex min-h-[4.5rem] items-center gap-2 rounded-[14px] border border-border bg-card pl-1 pr-4">
                  <button
                    onClick={() => onCheck(item)}
                    aria-label={`Vink ${item.name} af`}
                    className="group/check flex h-14 w-14 shrink-0 items-center justify-center"
                  >
                    <span className="h-7 w-7 rounded-full border-2 border-border-strong transition-colors duration-150 ease-smooth group-hover/check:border-primary group-hover/check:bg-primary-soft" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold tracking-[-0.01em] text-foreground">{name}</span>
                    {item.fromRecipe && <span className="block truncate text-xs text-accent-ink">uit {item.fromRecipe}</span>}
                  </span>
                  {amount && <span className="shrink-0 text-[0.9375rem] tabular-nums text-muted-foreground">{amount}</span>}
                </div>
              </SwipeToCheck>
            );
          })}
        </div>
      </div>

      {!klaar && (
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">Veeg naar rechts om af te vinken</p>
            <Button
              variant="secondary"
              className="min-h-12 shrink-0 gap-2"
              onClick={laatste ? onClose : volgende}
            >
              {laatste ? 'Afronden' : 'Volgende afdeling'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>,
    document.body,
  );
};

export default ShoppingMode;
