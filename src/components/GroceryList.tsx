import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus, Trash2, X, Merge, TrendingUp, ExternalLink, Loader2, ShoppingBasket, ShoppingCart, Tag, MoreVertical, RefreshCw } from 'lucide-react';
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
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import SwipeToCheck from '@/components/SwipeToCheck';
import EmptyState from '@/components/EmptyState';
import DepartmentHeading from '@/components/DepartmentHeading';
import AhProductSheet from '@/components/AhProductSheet';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
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
  const [pricing, setPricing] = useState(false);
  const [showChecked, setShowChecked] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const { loading, groceryItems, addGroceryItem, setGroceryItemChecked, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems, applyAhMatches, frequentItems, trackPurchase } = useAppContext();

  const handleAdd = (name?: string) => {
    const item = (name || newItem).trim();
    if (item) {
      addGroceryItem(item);
      setNewItem('');
    }
  };

  const checkOff = (item: GroceryItem) => {
    trackPurchase(item.name);
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

  const categorized = order === 'department' ? sortByStoreRoute(unchecked) : null;
  const productItem = groceryItems.find((i) => i.id === productItemId) ?? null;

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

  const renderItem = (item: GroceryItem) =>
    <SwipeToCheck key={item.id} onSwipe={() => checkOff(item)}>
      <div className="flex min-h-14 items-center gap-1.5 rounded-xl border border-border bg-card py-1 pl-0.5 pr-1">
        <button
          onClick={() => checkOff(item)}
          aria-label={`Vink ${item.name} af`}
          className="h-11 w-11 shrink-0 flex items-center justify-center group/check"
        >
          <span className="h-6 w-6 rounded-[8px] border-2 border-primary transition-colors group-hover/check:bg-primary-soft" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[0.9375rem] font-medium">{item.name}</span>
            {item.fromRecipe && <span className="text-xs text-muted-foreground">voor {item.fromRecipe}</span>}
          </div>
          {item.ahProduct && (
            <button
              type="button"
              onClick={() => setProductItemId(item.id)}
              title="Kies een ander product"
              className="relative -my-3.5 flex max-w-full items-center gap-1.5 py-3.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">
                {item.ahProduct.quantity}× {item.ahProduct.title}{item.ahProduct.unitSize ? ` · ${item.ahProduct.unitSize}` : ''}
              </span>
              {item.ahProduct.isBonus && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ah-bonus/15 px-1.5 py-0.5 font-semibold text-accent-ink"><Tag className="h-3 w-3" aria-hidden="true" />Bonus</span>
              )}
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          )}
          {!item.ahProduct && item.priceCheckedAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setProductItemId(item.id)}
                className="relative -my-3.5 inline-block py-3.5 font-medium text-primary hover:underline"
              >
                Kies zelf
              </button>
              {' · '}
              <a
                href={ahSearchUrl(item.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative -my-3.5 inline-block py-3.5 font-medium text-primary hover:underline"
              >
                Zoek bij AH
              </a>
            </p>
          )}
        </div>
        {item.price != null && (
          <span className="shrink-0 font-display text-sm font-semibold tabular-nums">{euro.format(item.price)}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Opties voor ${item.name}`}
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
              <a href={ahSearchUrl(item.name)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Zoek bij AH
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
              <a href={`https://www.jumbo.com/producten/?searchTerms=${toSearchQuery(item.name)}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Zoek bij Jumbo
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => removeGroceryItem(item.id)}
              className="gap-2 min-h-11 cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SwipeToCheck>;

  return (
    <div className="space-y-6">
      {/* Add item */}
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

      {/* Frequent item suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground mt-1" />
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

      {/* Order and list actions */}
      {groceryItems.length > 0 &&
        <div className="space-y-2">
          <div role="group" aria-label="Volgorde van je lijst" className="flex gap-2">
            {([['department', 'Op afdeling'], ['added', 'Op volgorde']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeOrder(value)}
                aria-pressed={order === value}
                className={`min-h-11 rounded-full px-3.5 text-[0.8125rem] font-semibold transition-colors ${
                  order === value ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-border text-foreground/80 hover:border-border-strong'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={mergeDuplicateItems}
              className="text-primary hover:underline flex items-center gap-1 text-sm min-h-11">
              <Merge className="h-3 w-3" /> Dubbele samenvoegen
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-destructive hover:underline flex items-center gap-1 text-sm min-h-11">
                  <Trash2 className="h-3 w-3" /> Lijst leegmaken
                </button>
              </AlertDialogTrigger>
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
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAllItems}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Leegmaken
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      }

      {/* Loading */}
      {loading &&
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      }

      {/* Empty state */}
      {!loading && unchecked.length === 0 && checked.length === 0 &&
        <EmptyState
          icon={ShoppingCart}
          title="Je lijst is leeg"
          body="Typ wat je nodig hebt, of zet een recept op je lijst."
          action={onNavigate ? { label: 'Naar recepten', onClick: () => onNavigate('recipes') } : undefined}
        />
      }

      {/* Items - per department */}
      {categorized &&
        <div className="space-y-4">
          {categorized.map((group) =>
            <div key={group.category}>
              <DepartmentHeading category={group.category} label={group.label} count={group.items.length} />
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

      {/* Checked items, collapsed until you open them */}
      {checked.length > 0 &&
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowChecked((open) => !open)}
              aria-expanded={showChecked}
              className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showChecked ? 'rotate-180' : ''}`} />
              Afgevinkt ({checked.length})
            </button>
            <button onClick={clearCheckedItems} className="text-sm text-destructive hover:underline flex items-center gap-1 min-h-11 px-1">
              <Trash2 className="h-3.5 w-3.5" /> Weghalen
            </button>
          </div>
          {showChecked && checked.map((item) =>
            <div key={item.id} className="group flex min-h-14 items-center gap-1.5 rounded-xl border border-border/70 bg-background py-1 pl-0.5 pr-1">
              <button
                onClick={() => { void setGroceryItemChecked(item.id, false); }}
                aria-label={`Zet ${item.name} terug op je lijst`}
                className="h-11 w-11 shrink-0 flex items-center justify-center"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-primary">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                </span>
              </button>
              <span className="flex-1 text-[0.9375rem] text-muted-foreground line-through">{item.name}</span>
              <button
                onClick={() => removeGroceryItem(item.id)}
                aria-label={`Verwijder ${item.name}`}
                className="h-11 w-11 shrink-0 flex items-center justify-center text-destructive transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      }

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
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-xs text-muted-foreground">Totaal bij AH</p>
                    <p className="font-display text-xl font-bold tabular-nums">{euro.format(ahTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAhPrices}
                    disabled={pricing}
                    aria-label="AH-prijzen verversen"
                    title="AH-prijzen verversen"
                    className="h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${pricing ? 'animate-spin' : ''}`} />
                  </button>
                  <Button asChild variant="ah" className="shrink-0 px-3">
                    <a
                      href={ahBasketUrl(pricedItems.flatMap((i) => (i.ahProduct ? [{ id: i.ahProduct.id, quantity: i.ahProduct.quantity }] : [])))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShoppingBasket className="h-4 w-4" /> Alles in AH-mandje
                    </a>
                  </Button>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{pricedItems.length} van {unchecked.length} gevonden{bonusCount > 0 ? ` · ${bonusCount} in de bonus` : ''}</span> · Je bestelt bij AH, in de app of op ah.nl.
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
