import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, X, Merge, TrendingUp, Loader2, ShoppingBasket, ShoppingCart, Tag, MoreVertical, RefreshCw, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { AH_MAX_ITEMS, ahBasketUrl, matchAhProducts } from '@/services/ahApi';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SwipeToCheck from '@/components/SwipeToCheck';
import GroceryItemSheet from '@/components/GroceryItemSheet';
import ShoppingMode from '@/components/ShoppingMode';
import EmptyState from '@/components/EmptyState';
import DepartmentHeading, { DEPARTMENT_CHIP, DEPARTMENT_DOT } from '@/components/DepartmentHeading';
import AhProductSheet from '@/components/AhProductSheet';
import { sortByStoreRoute, type Department } from '@/lib/storeRouteSort';
import { splitAmount } from '@/lib/itemAmount';
import { translateForSearch } from '@/lib/groceryTranslations';
import type { GroceryItem } from '@/types';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// Strip quantity prefix and translate for AH search
const toSearchQuery = (name: string) => {
  const stripped = name.replace(/^\d+(?:[.,]\d+)?\s+/, '');
  return encodeURIComponent(translateForSearch(stripped));
};

const ahSearchUrl = (name: string) => `https://www.ah.nl/zoeken?query=${toSearchQuery(name)}`;

type ListOrder = 'department' | 'added';
const ORDER_KEY = 'couplecart-list-order';

// Remembered per device: departments in the store, maybe the typed order at home.
const readListOrder = (): ListOrder => {
  try {
    return localStorage.getItem(ORDER_KEY) === 'added' ? 'added' : 'department';
  } catch {
    return 'department';
  }
};

interface GroceryListProps {
  onNavigate?: (tab: 'recipes') => void;
  /** False on the shared page, which has no bottom tab bar for the price bar to sit on. */
  aboveTabBar?: boolean;
}

const GroceryList = ({ onNavigate, aboveTabBar = true }: GroceryListProps) => {
  const [newItem, setNewItem] = useState('');
  const [order, setOrder] = useState<ListOrder>(readListOrder);
  const [productItemId, setProductItemId] = useState<string | null>(null);
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<Department | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [shopping, setShopping] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [showChecked, setShowChecked] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const { loading, groceryItems, addGroceryItem, setGroceryItemChecked, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems, applyAhMatches, frequentItems, trackPurchase, stockUp } = useAppContext();

  const handleAdd = (name?: string) => {
    const item = (name || newItem).trim();
    if (item) {
      addGroceryItem(item);
      setNewItem('');
    }
  };

  const checkOff = (item: GroceryItem) => {
    trackPurchase(item.name);
    // Wat in het mandje gaat, staat straks in de kast.
    void stockUp(item.name, 'lijst');
    void setGroceryItemChecked(item.id, true);
    toast(`“${item.name}” afgevinkt`, {
      action: { label: 'Ongedaan maken', onClick: () => { void setGroceryItemChecked(item.id, false); } },
    });
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);
  const pricedItems = unchecked.filter((i) => i.ahProduct);
  const ahTotal = pricedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const showBar = !loading && unchecked.length > 0;
  const hasPrices = pricedItems.length > 0;
  const bonusCount = pricedItems.filter((i) => i.ahProduct?.isBonus).length;
  // Alleen echt voordeel telt mee: wat AH zelf als prijs-vóór-bonus opgeeft.
  const saving = pricedItems.reduce((sum, i) => (
    i.priceBefore != null && i.price != null && i.priceBefore > i.price ? sum + (i.priceBefore - i.price) : sum
  ), 0);

  const fetchAhPrices = async () => {
    const batch = unchecked.slice(0, AH_MAX_ITEMS);
    if (batch.length === 0) return;
    setPricing(true);
    try {
      const { matches, unmatched } = await matchAhProducts(batch.map(({ id, name }) => ({ id, name })));
      await applyAhMatches(matches, unmatched ?? []);
      toast.success(matches.length === batch.length
        ? `Alle ${matches.length} boodschappen gevonden bij AH`
        : `${matches.length} van ${batch.length} boodschappen gevonden bij AH`);
    } catch (e) {
      console.error('AH prices failed:', e);
      toast.error('AH-prijzen ophalen lukte niet. Controleer je verbinding en probeer het opnieuw.', {
        action: { label: 'Opnieuw proberen', onClick: () => { void fetchAhPrices(); } },
      });
    } finally {
      setPricing(false);
    }
  };

  // The price bar is fixed: the list needs room below it, and toasts must sit above it.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      setBarHeight(0);
      return;
    }
    setBarHeight(bar.offsetHeight);
    const observer = new ResizeObserver(() => setBarHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [showBar, hasPrices]);

  useEffect(() => {
    if (!barHeight) return;
    const root = document.documentElement;
    const gap = aboveTabBar ? '5.5rem' : '1.5rem';
    root.style.setProperty('--toast-offset', `calc(${gap} + env(safe-area-inset-bottom) + ${barHeight}px)`);
    return () => { root.style.removeProperty('--toast-offset'); };
  }, [barHeight, aboveTabBar]);

  const alleGroepen = order === 'department' ? sortByStoreRoute(unchecked) : null;
  // Een gekozen afdeling laat alleen die plank zien; "Alles" laat ze allemaal.
  const categorized = alleGroepen && deptFilter
    ? alleGroepen.filter((group) => group.category === deptFilter)
    : alleGroepen;
  const productItem = groceryItems.find((i) => i.id === productItemId) ?? null;
  const sheetItem = groceryItems.find((i) => i.id === sheetItemId) ?? null;
  const sheetDepartment = alleGroepen?.find((group) => group.items.some((i) => i.id === sheetItemId))?.label;

  const changeOrder = (next: ListOrder) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, next);
    } catch {
      // Storage blocked; the choice lasts until the page reloads.
    }
  };

  // Filter suggestions
  const currentNames = groceryItems.map((i) => i.name.toLowerCase());
  const suggestions = frequentItems.filter((f) => !currentNames.includes(f.name));

  const renderItem = (item: GroceryItem) => {
    const { name, amount } = splitAmount(item.name);
    const bonus = item.ahProduct?.isBonus;
    return (
      <SwipeToCheck key={item.id} onSwipe={() => checkOff(item)}>
        <div className="flex min-h-[3.5rem] items-center gap-1 rounded-[14px] border border-border bg-card pl-1 pr-3">
          <button
            onClick={() => checkOff(item)}
            aria-label={`Vink ${item.name} af`}
            className="group/check flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span className="h-6 w-6 rounded-full border-2 border-border-strong transition-colors duration-150 ease-smooth group-hover/check:border-primary group-hover/check:bg-primary-soft" />
          </button>

          {/* De hele regel opent het venster; het vinkje blijft de snelste weg. */}
          <button
            type="button"
            onClick={() => setSheetItemId(item.id)}
            aria-label={`Opties voor ${item.name}`}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-medium text-foreground">{name}</span>
              {item.fromRecipe && (
                <span className="block truncate text-xs text-accent-ink">uit {item.fromRecipe}</span>
              )}
              {item.ahProduct && (
                <span className="block truncate text-xs text-muted-foreground">{item.ahProduct.title}</span>
              )}
              {!item.ahProduct && item.priceCheckedAt && (
                <span className="block text-xs text-muted-foreground">niet gevonden bij AH</span>
              )}
            </span>

            <span className="shrink-0 text-right">
              {item.price != null ? (
                <>
                  <span className="block font-display text-[0.9375rem] font-bold tabular-nums text-foreground">
                    {euro.format(item.price)}
                  </span>
                  {item.priceBefore != null && item.priceBefore > item.price && (
                    <span className="block text-[0.6875rem] tabular-nums text-muted-foreground line-through">
                      {euro.format(item.priceBefore)}
                    </span>
                  )}
                  {bonus && (
                    <span className="mt-0.5 inline-block rounded-md bg-[hsl(var(--ah-bonus))] px-1.5 py-px font-display text-[0.625rem] font-bold uppercase tracking-wide text-white">
                      Bonus
                    </span>
                  )}
                </>
              ) : amount ? (
                <span className="block text-[0.8125rem] tabular-nums text-muted-foreground">{amount}</span>
              ) : null}
            </span>
          </button>
        </div>
      </SwipeToCheck>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">Samen boodschappen</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? 'Je lijst wordt opgehaald'
              : unchecked.length === 0 && checked.length === 0
                ? 'Nog niets op je lijst'
                : `${unchecked.length} te halen · ${checked.length} in de kar`}
          </p>
        </div>
        {groceryItems.length > 0 && (
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            aria-label="Lijst leegmaken"
            title="Lijst leegmaken"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-muted-foreground transition-colors duration-150 ease-smooth hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" strokeWidth={1.9} />
          </button>
        )}
      </header>

      <div className="flex gap-2">
        <Input
          placeholder="Wat moet je halen?"
          aria-label="Wat moet je halen?"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-card border-border font-body" />
        <Button onClick={() => handleAdd()} size="icon" className="shrink-0 h-11 w-11" aria-label="Toevoegen">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <TrendingUp className="mt-1 h-4 w-4 text-muted-foreground" />
          {suggestions.map((item) => (
            <button
              key={item.name}
              onClick={() => handleAdd(item.name)}
              className="min-h-11 rounded-full bg-primary-soft px-3.5 text-[0.8125rem] font-semibold capitalize text-primary transition-colors hover:bg-primary-soft/70"
            >
              + {item.name}
            </button>
          ))}
        </div>
      )}

      {/* Afdelingen als tabs: springen in plaats van scrollen. */}
      {alleGroepen && alleGroepen.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max items-center gap-2">
            <button
              type="button"
              onClick={() => setDeptFilter(null)}
              aria-pressed={deptFilter === null}
              className={`min-h-11 rounded-full px-3.5 font-display text-xs font-bold transition-colors duration-150 ease-smooth ${
                deptFilter === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Alles
            </button>
            {alleGroepen.map((group) => (
              <button
                key={group.category}
                type="button"
                onClick={() => setDeptFilter(deptFilter === group.category ? null : group.category)}
                aria-pressed={deptFilter === group.category}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 font-display text-xs font-bold transition-colors duration-150 ease-smooth ${
                  deptFilter === group.category
                    ? `${DEPARTMENT_CHIP[group.category]} text-foreground ring-1 ring-current`
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${DEPARTMENT_DOT[group.category]}`} />
                {group.label.split(' ')[0].replace(',', '')}
                <span className="tabular-nums opacity-70">{group.items.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {groceryItems.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeOrder(order === 'department' ? 'added' : 'department')}
            className="min-h-11 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {order === 'department' ? 'Op afdeling' : 'Op volgorde'}
          </button>

          <div className="flex items-center gap-1">
            {unchecked.length > 0 && (
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => setShopping(true)}>
                <Store className="h-4 w-4" /> Winkelmodus
              </Button>
            )}

          {/* Wat je zelden doet, zit in een menu in plaats van in beeld. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Meer met deze lijst"
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="min-h-11 cursor-pointer gap-2" onSelect={() => { void mergeDuplicateItems(); }}>
                <Merge className="h-4 w-4" /> Dubbele samenvoegen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 cursor-pointer gap-2 text-destructive focus:text-destructive"
                onSelect={(e) => { e.preventDefault(); setClearOpen(true); }}
              >
                <Trash2 className="h-4 w-4" /> Lijst leegmaken
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hele lijst leegmaken?</AlertDialogTitle>
                <AlertDialogDescription>
                  {groceryItems.length === 1
                    ? 'De boodschap verdwijnt, ook voor wie meekijkt.'
                    : `Alle ${groceryItems.length} boodschappen verdwijnen, ook voor wie meekijkt.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearAllItems}
                  className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Leegmaken
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Loading */}
      {loading &&
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      }

      {!loading && unchecked.length === 0 && checked.length === 0 && (
        <section className="rounded-[14px] border border-border bg-card p-5 text-center">
          <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ShoppingCart className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold tracking-[-0.01em] text-foreground">Schone lei</h2>
          <p className="mx-auto mt-1 max-w-[18rem] text-sm text-muted-foreground">
            Begin met typen, of haal een recept op. Jullie zien allebei direct hetzelfde.
          </p>
          {onNavigate && (
            <Button variant="outline" className="mt-4 min-h-12 w-full" onClick={() => onNavigate('recipes')}>
              Uit een recept
            </Button>
          )}
        </section>
      )}

      {/* Items - per department */}
      {categorized &&
        <div className="space-y-4">
          {categorized.map((group) =>
            <div key={group.category}>
              {!deptFilter && <DepartmentHeading category={group.category} label={group.label} count={group.items.length} />}
              <div className="space-y-2">
                {group.items.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      }

      {/* Items - in the order they were added */}
      {!categorized &&
        <div className="space-y-2">
          {unchecked.map(renderItem)}
        </div>
      }

      {/* Wat in de kar ligt, op één regel. Openklappen als je iets terug wil. */}
      {checked.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-[14px] border border-border bg-muted/40 px-3">
            <button
              type="button"
              onClick={() => setShowChecked((open) => !open)}
              aria-expanded={showChecked}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left text-sm text-muted-foreground"
            >
              <span className="shrink-0 font-medium text-foreground">In de kar</span>
              <span className="shrink-0 tabular-nums">· {checked.length} ·</span>
              <span className="min-w-0 flex-1 truncate">{checked.map((i) => i.name).join(', ')}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-smooth ${showChecked ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showChecked && (
            <>
              {checked.map((item) => (
                <div key={item.id} className="group flex min-h-[3.5rem] items-center gap-1 rounded-[14px] border border-border/70 bg-background pl-1 pr-3">
                  <button
                    onClick={() => { void setGroceryItemChecked(item.id, false); }}
                    aria-label={`Zet ${item.name} terug op je lijst`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                    </span>
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-muted-foreground line-through">{item.name}</span>
                  <button
                    onClick={() => removeGroceryItem(item.id)}
                    aria-label={`Verwijder ${item.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={clearCheckedItems} className="flex min-h-11 items-center gap-1 text-sm text-destructive hover:underline">
                <Trash2 className="h-3.5 w-3.5" /> Alles uit de kar weghalen
              </button>
            </>
          )}
        </div>
      )}

      {shopping && (
        <ShoppingMode items={groceryItems} onCheck={checkOff} onClose={() => setShopping(false)} />
      )}

      <GroceryItemSheet
        item={sheetItem}
        department={sheetDepartment}
        onClose={() => setSheetItemId(null)}
        onPickProduct={(id) => setProductItemId(id)}
      />
      <AhProductSheet item={productItem} onClose={() => setProductItemId(null)} />

      {/* Room for the fixed price bar */}
      {showBar && <div aria-hidden="true" style={{ height: barHeight }} />}

      {/* AH total and basket, fixed above the tab bar */}
      {showBar &&
        <div
          ref={barRef}
          className={`above-tabbar fixed inset-x-0 z-10 border-t border-border bg-background/95 backdrop-blur-md ${
            aboveTabBar
              ? 'bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] sm:bottom-0 sm:pb-[env(safe-area-inset-bottom)]'
              : 'bottom-0 pb-[env(safe-area-inset-bottom)]'}`}
        >
          <div className="mx-auto max-w-lg px-4 py-2">
            {hasPrices ? (
              <>
                {/* Groen vlak met het totaal, oranje knop naar het mandje. */}
                <div className="flex items-center gap-3 rounded-[14px] bg-primary px-3.5 py-2.5">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[0.6875rem] text-primary-muted">
                      Totaal bij AH{saving > 0.004 ? ` · je bespaart ${euro.format(saving)}` : bonusCount > 0 ? ` · ${bonusCount} in de bonus` : ''}
                    </p>
                    <p className="font-display text-xl font-bold tabular-nums text-primary-foreground">{euro.format(ahTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAhPrices}
                    disabled={pricing}
                    aria-label="AH-prijzen verversen"
                    title="AH-prijzen verversen"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-muted hover:text-primary-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${pricing ? 'animate-spin' : ''}`} />
                  </button>
                  <Button asChild variant="secondary" className="min-h-11 shrink-0 px-4">
                    <a
                      href={ahBasketUrl(pricedItems.flatMap((i) => (i.ahProduct ? [{ id: i.ahProduct.id, quantity: i.ahProduct.quantity }] : [])))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShoppingBasket className="h-4 w-4" /> In mandje
                    </a>
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{pricedItems.length} van {unchecked.length} gevonden</span> · Je bestelt bij AH, in de app of op ah.nl.
                </p>
              </>
            ) : (
              <Button type="button" onClick={fetchAhPrices} disabled={pricing} className="min-h-11 w-full gap-2">
                {pricing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Prijzen zoeken…</>
                  : <><Tag className="h-4 w-4" /> Bekijk wat het kost bij AH</>}
              </Button>
            )}
          </div>
        </div>
      }
    </div>
  );
};

export default GroceryList;
