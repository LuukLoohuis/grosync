import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, X, Merge, TrendingUp, Loader2, ShoppingBasket, ShoppingCart, Tag, MoreVertical, RefreshCw, Search, Scale, Share2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { AH_MAX_ITEMS, ahBasketUrl, matchAhProducts } from '@/services/ahApi';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SwipeToCheck from '@/components/SwipeToCheck';
import { CheckCircle, Wegvinken, useWegvinken } from '@/components/CheckOff';
import { toastWithUndo } from '@/lib/undoableDelete';
import { deelTekst, lijstAlsTekst } from '@/lib/lijstTekst';
import GroceryItemSheet from '@/components/GroceryItemSheet';
import ShoppingMode from '@/components/ShoppingMode';
import SnelInvoer from '@/components/SnelInvoer';
import ItemThumb from '@/components/ItemThumb';
import { huiskleur, voorWinkel, winkelsOpLijst, zelfdeWinkel, zonderWinkel } from '@/lib/winkels';
import WinkelLabel, { WinkelStip } from '@/components/WinkelLabel';
import { useAhKoppeling } from '@/hooks/useAhKoppeling';
import { koppelWinkel, PRIJSVERGELIJK_AAN, productWinkel } from '@/lib/ahKoppeling';
import EmptyState from '@/components/EmptyState';
import DepartmentHeading, { DEPARTMENT_CHIP, DEPARTMENT_DOT } from '@/components/DepartmentHeading';
import AhProductSheet from '@/components/AhProductSheet';
import PlusSheet from '@/components/PlusSheet';
import PrijsVergelijkSheet from '@/components/PrijsVergelijkSheet';
import { FREE_LIMIT } from '@/hooks/useEntitlements';
import { QuotaError } from '@/services/functions';
import { sortByStoreRoute, type Department } from '@/lib/storeRouteSort';
import { splitAmount } from '@/lib/itemAmount';
import { countParts } from '@/lib/itemCount';
import { CountPill, CountQuickPicks, CountStepper, useCountEditor } from '@/components/ItemCount';
import { translateForSearch } from '@/lib/groceryTranslations';
import type { GroceryItem } from '@/types';
import { locale, t } from '@/lib/i18n';

const euro = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' });

// Strip quantity prefix and translate for AH search
const toSearchQuery = (name: string) => {
  const stripped = name.replace(/^\d+(?:[.,]\d+)?(?:\s*[×x])?\s+/, '');
  return encodeURIComponent(translateForSearch(stripped));
};

const ahSearchUrl = (name: string) => `https://www.ah.nl/zoeken?query=${toSearchQuery(name)}`;

// Vanaf zoveel open boodschappen verschijnt het vergrootglas.
const ZOEK_VANAF = 15;
// En vanaf zoveel de rij met afdelingen; bij een korte lijst zie je alles al.
const AFDELINGEN_VANAF = 8;

// Zoeken zonder op hoofdletters of accenten te letten: "creme" vindt "crème".
const kaal = (tekst: string) => tekst.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Eén kaart per afdeling, met een lijn tussen de regels: een plank, geen stapel losse kaartjes.
const PLANK = 'divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card';

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
  const [order, setOrder] = useState<ListOrder>(readListOrder);
  const [productItemId, setProductItemId] = useState<string | null>(null);
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<Department | null>(null);
  const [winkelFilter, setWinkelFilter] = useState<string | null>(null);
  const [shopping, setShopping] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [overLimit, setOverLimit] = useState(false);
  const [vergelijken, setVergelijken] = useState(false);
  const [showChecked, setShowChecked] = useState(false);
  // null: de zoekbalk is dicht.
  const [zoek, setZoek] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  const { loading, groceryItems, addGroceryItem, setGroceryItemChecked, removeGroceryItem, clearCheckedItems, clearAllItems, mergeDuplicateItems, applyAhMatches, setGroceryItemCount, frequentItems, trackPurchase, plus, remaining, refreshEntitlements } = useAppContext();
  useAhKoppeling(groceryItems, applyAhMatches);

  const countEditor = useCountEditor(
    (id, count) => { void setGroceryItemCount(id, count); },
    removeGroceryItem,
  );

  const handleAdd = (name: string) => {
    const item = name.trim();
    if (item) addGroceryItem(item);
  };

  // Elke keer dat er iets in de kar valt, veert de teller even op.
  const [telOp, setTelOp] = useState(0);

  const { weg, vink: checkOff } = useWegvinken<GroceryItem>((item) => {
    trackPurchase(item.name);
    // De kast is van jou alleen: die vul je met een foto of met de hand, niet
    // vanuit de lijst.
    void setGroceryItemChecked(item.id, true);
    setTelOp((n) => n + 1);
    toastWithUndo(t("“{0}” afgevinkt", [item.name]), () => { void setGroceryItemChecked(item.id, false); });
  });

  const deelLijst = async () => {
    const uitkomst = await deelTekst(lijstAlsTekst(groceryItems));
    if (uitkomst === 'gekopieerd') toast.success(t("Lijst gekopieerd. Plak hem waar je wilt."));
    else if (uitkomst === 'mislukt') toast.error(t("Delen lukte niet. Probeer het opnieuw."));
  };

  const unchecked = groceryItems.filter((i) => !i.checked);
  const checked = groceryItems.filter((i) => i.checked);
  // Het totaal en het mandje zijn van AH; een Jumbo- of Dirk-product hoort daar niet in.
  const pricedItems = unchecked.filter((i) => productWinkel(i) === 'AH');
  // Wat bij AH hoort: alles behalve wat je bij Jumbo of Dirk haalt (die krijgen daar een product).
  const voorAh = unchecked.filter((i) => (koppelWinkel(i.store) ?? 'AH') === 'AH');
  const ahTotal = pricedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const showBar = !loading && unchecked.length > 0;
  const hasPrices = pricedItems.length > 0;
  const bonusCount = pricedItems.filter((i) => i.ahProduct?.isBonus).length;
  // Alleen echt voordeel telt mee: wat AH zelf als prijs-vóór-bonus opgeeft.
  const saving = pricedItems.reduce((sum, i) => (
    i.priceBefore != null && i.price != null && i.priceBefore > i.price ? sum + (i.priceBefore - i.price) : sum
  ), 0);

  // Het karretje vullen bij AH telt mee in het tegoed, verversen ook.
  const mandjeOp = !plus && remaining('mandje') === 0;

  const fetchAhPrices = async () => {
    const batch = voorAh.slice(0, AH_MAX_ITEMS);
    if (batch.length === 0) return;
    if (mandjeOp) { setOverLimit(true); return; }
    setPricing(true);
    try {
      const { matches, unmatched } = await matchAhProducts(batch.map(({ id, name }) => ({ id, name })));
      await applyAhMatches(matches, unmatched ?? []);
      toast.success(matches.length === batch.length
        ? t("Alle {0} boodschappen gevonden bij AH", [matches.length])
        : t('{0} van {1} boodschappen gevonden bij AH', [matches.length, batch.length]));
    } catch (e) {
      if (e instanceof QuotaError) {
        setOverLimit(true);
      } else {
        console.error('AH prices failed:', e);
        toast.error(t("AH-prijzen ophalen lukte niet. Controleer je verbinding en probeer het opnieuw."), {
          action: { label: t("Opnieuw proberen"), onClick: () => { void fetchAhPrices(); } },
        });
      }
    } finally {
      void refreshEntitlements();
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

  const zoekterm = zoek ? kaal(zoek.trim()) : '';
  const zoekt = zoekterm.length > 0;
  // Eén winkel kiezen laat zien wat daar hoort plus wat overal kan.
  const winkels = winkelsOpLijst(groceryItems);
  const actieveWinkel = winkels.find((w) => zelfdeWinkel(w, winkelFilter)) ?? null;
  const inWinkel = voorWinkel(unchecked, actieveWinkel);
  const zichtbaar = zoekt
    ? inWinkel.filter((i) => kaal(i.name).includes(zoekterm) || (i.note && kaal(i.note).includes(zoekterm)) || (i.ahProduct && kaal(i.ahProduct.title).includes(zoekterm)))
    : inWinkel;
  const kanZoeken = unchecked.length >= ZOEK_VANAF || zoek !== null;
  const sluitZoeken = () => setZoek(null);

  const alleGroepen = order === 'department' ? sortByStoreRoute(zichtbaar) : null;
  // Een gekozen afdeling laat alleen die plank zien; "Alles" laat ze allemaal.
  const categorized = alleGroepen && deptFilter && !zoekt
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

  // Wat er bij het openen al stond, schuift niet binnen; alleen wat er daarna bijkomt.
  const gezien = useRef<Set<string> | null>(null);
  if (gezien.current === null && !loading) gezien.current = new Set(groceryItems.map((i) => i.id));
  const nieuw = (id: string) => gezien.current !== null && !gezien.current.has(id);
  useEffect(() => {
    // Pas na de animatie als gezien tellen: een tussentijdse render breekt hem dan niet af.
    const ids = groceryItems.map((i) => i.id);
    const timer = window.setTimeout(() => ids.forEach((id) => gezien.current?.add(id)), 300);
    return () => window.clearTimeout(timer);
  }, [groceryItems]);

  const renderItem = (item: GroceryItem) => {
    // Het aantal staat in de pil; naast de naam blijft alleen gewicht of inhoud ("500 g").
    const { name, amount } = splitAmount(zonderWinkel(item.ahProduct ? item.name : countParts(item.name).rest, item.store));
    const bonus = item.ahProduct?.isBonus;
    const editing = countEditor.editing?.id === item.id;
    return (
      <Wegvinken key={item.id} weg={weg.has(item.id)}>
      <SwipeToCheck onSwipe={() => checkOff(item)} onRemove={() => removeGroceryItem(item.id)} className="">
        <div
          data-count-editor={item.id}
          className={`transition-colors duration-150 ease-smooth ${editing ? 'bg-primary-soft/50' : 'bg-card'} ${nieuw(item.id) ? 'animate-rij-in' : ''}`}
        >
          <div className="flex min-h-14 items-center gap-1 pl-1 pr-1.5">
            <button
              onClick={() => checkOff(item)}
              aria-label={t("Vink {0} af", [item.name])}
              className="group/check flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <CheckCircle on={weg.has(item.id)} />
            </button>

            {/* De hele regel opent het venster; het vinkje blijft de snelste weg. */}
            <button
              type="button"
              onClick={() => setSheetItemId(item.id)}
              aria-label={t("Opties voor {0}", [item.name])}
              className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ItemThumb item={item} label={name} vergroot={false} className="h-10 w-10 rounded-[10px] text-base" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.9375rem] font-medium text-foreground">{name}</span>
                  {item.store && <WinkelLabel winkel={item.store} />}
                </span>
                {item.note && <span className="block truncate text-xs text-foreground/75">{item.note}</span>}
                {item.fromRecipe && (
                  <span className="block truncate text-xs text-accent-ink">uit {item.fromRecipe}</span>
                )}
                {item.ahProduct && (
                  <span className="block truncate text-xs text-muted-foreground">{item.ahProduct.title}</span>
                )}
                {!item.ahProduct && item.priceCheckedAt && (
                  <span className="block text-xs text-muted-foreground">{t("niet gevonden bij {0}", [koppelWinkel(item.store) ?? 'AH'])}</span>
                )}
              </span>

              <span className={`shrink-0 text-right ${editing ? 'hidden' : ''}`}>
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
                        {t("Bonus")}
                      </span>
                    )}
                  </>
                ) : amount ? (
                  <span className="block text-[0.8125rem] tabular-nums text-muted-foreground">{amount}</span>
                ) : null}
              </span>
            </button>

            {editing
              ? <CountStepper item={item} editor={countEditor} />
              : <CountPill item={item} onOpen={() => countEditor.open(item)} />}
          </div>
          {editing && <CountQuickPicks editor={countEditor} />}
        </div>
      </SwipeToCheck>
      </Wegvinken>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">{t("Samen boodschappen")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? t("Je lijst wordt opgehaald")
              : unchecked.length === 0 && checked.length === 0
                ? t("Nog niets op je lijst")
                : t("{0} te halen · {1} in de kar", [unchecked.length, checked.length])}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
        {kanZoeken && (
          <button
            type="button"
            onClick={() => (zoek === null ? setZoek('') : sluitZoeken())}
            aria-label={zoek === null ? t("Zoeken in je lijst") : t("Zoeken sluiten")}
            aria-pressed={zoek !== null}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border transition-colors duration-150 ease-smooth ${
              zoek !== null ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="h-5 w-5" strokeWidth={1.9} />
          </button>
        )}
        </div>
      </header>

      {zoek !== null && (
        <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            enterKeyHint="search"
            placeholder={t("Zoek in je lijst")}
            aria-label={t("Zoek in je lijst")}
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') sluitZoeken(); }}
            className="border-primary/40 bg-card pl-9 pr-11 font-body [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            onClick={sluitZoeken}
            aria-label={t("Zoeken sluiten")}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {zoekt && zichtbaar.length === 0 && (
        <section className="rounded-[14px] border border-dashed border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">{t("“{0}” staat niet op je lijst", [zoek!.trim()])}</p>
          <Button
            variant="outline"
            className="mt-3 min-h-11 gap-2"
            onClick={() => { handleAdd(zoek!.trim()); sluitZoeken(); }}
          >
            <Plus className="h-4 w-4" /> {t("Zet “{0}” op de lijst", [zoek!.trim()])}
          </Button>
        </section>
      )}

      <SnelInvoer />

      {!zoekt && suggestions.length > 0 && (
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

      {/* Winkels: alleen als er labels op de lijst staan. */}
      {!zoekt && winkels.length > 0 && (
        <div role="radiogroup" aria-label={t("Winkel")} className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max items-center gap-2">
            <Store aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            {[null, ...winkels].map((w) => {
              const aan = w === actieveWinkel;
              const aantal = w ? unchecked.filter((i) => zelfdeWinkel(i.store, w)).length : unchecked.length;
              return (
                <button
                  key={w ?? ''}
                  type="button"
                  role="radio"
                  aria-checked={aan}
                  onClick={() => { setWinkelFilter(w); setDeptFilter(null); }}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold transition-colors duration-150 ease-smooth ${
                    aan ? (huiskleur(w) ?? 'bg-foreground text-background') : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {!aan && <WinkelStip winkel={w} />}
                  {w ?? t("Alle winkels")}
                  <span className="tabular-nums opacity-70">{aantal}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Afdelingen als tabs: springen in plaats van scrollen. Pas bij een lange lijst. */}
      {!zoekt && alleGroepen && alleGroepen.length > 1 && (unchecked.length >= AFDELINGEN_VANAF || deptFilter) && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 animate-in fade-in-0 duration-200 ease-smooth [scrollbar-width:none]">
          <div className="flex w-max items-center gap-2">
            <button
              type="button"
              onClick={() => setDeptFilter(null)}
              aria-pressed={deptFilter === null}
              className={`min-h-11 rounded-full px-3.5 font-display text-xs font-bold transition-colors duration-150 ease-smooth ${
                deptFilter === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t("Alles")}
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
            {order === 'department' ? t("Op afdeling") : t("Op volgorde")}
          </button>

          <div className="flex items-center gap-1">
            {unchecked.length > 0 && (
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => setShopping(true)}>
                <Store className="h-4 w-4" /> {t("Winkelmodus")}
              </Button>
            )}

          {/* Wat je zelden doet, zit in een menu in plaats van in beeld. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t("Meer met deze lijst")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {unchecked.length > 0 && (
                <DropdownMenuItem className="min-h-11 cursor-pointer gap-2" onSelect={() => { void deelLijst(); }}>
                  <Share2 className="h-4 w-4" /> {t("Delen als tekst")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="min-h-11 cursor-pointer gap-2" onSelect={() => { void mergeDuplicateItems(); }}>
                <Merge className="h-4 w-4" /> {t("Dubbele samenvoegen")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 cursor-pointer gap-2 text-destructive focus:text-destructive"
                onSelect={() => { void clearAllItems(); }}
              >
                <Trash2 className="h-4 w-4" /> {t("Lijst leegmaken")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

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
          <h2 className="mt-3 font-display text-xl font-bold tracking-[-0.01em] text-foreground">{t("Schone lei")}</h2>
          <p className="mx-auto mt-1 max-w-[18rem] text-sm text-muted-foreground">
            {t("Begin met typen, of haal een recept op. Jullie zien allebei direct hetzelfde.")}
          </p>
          {onNavigate && (
            <Button variant="outline" className="mt-4 min-h-12 w-full" onClick={() => onNavigate('recipes')}>
              {t("Uit een recept")}
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
              <div className={PLANK}>
                {group.items.map(renderItem)}
              </div>
            </div>
          )}
        </div>
      }

      {/* Items - in the order they were added */}
      {!categorized && zichtbaar.length > 0 &&
        <div className={PLANK}>
          {zichtbaar.map(renderItem)}
        </div>
      }

      {/* Wat in de kar ligt, op één regel. Openklappen als je iets terug wil. */}
      {!zoekt && checked.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-[14px] border border-border bg-muted/40 px-3">
            <button
              type="button"
              onClick={() => setShowChecked((open) => !open)}
              aria-expanded={showChecked}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left text-sm text-muted-foreground"
            >
              <span className="shrink-0 font-medium text-foreground">{t("In de kar")}</span>
              <span key={telOp} className={`inline-block shrink-0 tabular-nums ${telOp ? 'animate-tel-op' : ''}`}>· {checked.length} ·</span>
              <span className="min-w-0 flex-1 truncate">{checked.map((i) => i.name).join(', ')}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-smooth ${showChecked ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showChecked && (
            <>
              {checked.map((item) => (
                <div key={item.id} className="group flex min-h-14 items-center gap-1 rounded-[14px] border border-border/70 bg-background pl-1 pr-3">
                  <button
                    onClick={() => { void setGroceryItemChecked(item.id, false); }}
                    aria-label={t("Zet {0} terug op je lijst", [item.name])}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                    </span>
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-muted-foreground line-through">{item.name}</span>
                  <button
                    onClick={() => removeGroceryItem(item.id)}
                    aria-label={t("Verwijder {0}", [item.name])}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={clearCheckedItems} className="flex min-h-11 items-center gap-1 text-sm text-destructive hover:underline">
                <Trash2 className="h-3.5 w-3.5" /> {t("Alles uit de kar weghalen")}
              </button>
            </>
          )}
        </div>
      )}

      {shopping && (
        <ShoppingMode items={groceryItems} weg={weg} onCheck={checkOff} onClose={() => setShopping(false)} startWinkel={actieveWinkel} />
      )}

      <GroceryItemSheet
        item={sheetItem}
        department={sheetDepartment}
        onClose={() => setSheetItemId(null)}
        onPickProduct={(id) => setProductItemId(id)}
      />
      <AhProductSheet item={productItem} onClose={() => setProductItemId(null)} />
      <PlusSheet feature={overLimit ? 'mandje' : null} onClose={() => setOverLimit(false)} />
      {PRIJSVERGELIJK_AAN && (
        <PrijsVergelijkSheet
          open={vergelijken}
          items={unchecked}
          onClose={() => setVergelijken(false)}
          onOverLimit={() => setOverLimit(true)}
          onKlaar={() => { void refreshEntitlements(); }}
        />
      )}

      {/* Room for the fixed price bar */}
      {showBar && <div aria-hidden="true" style={{ height: barHeight }} />}

      {/* AH total and basket, fixed above the tab bar */}
      {showBar &&
        <div
          ref={barRef}
          className={`above-tabbar fixed inset-x-0 z-10 border-t border-border bg-background ${
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
                      {t("Totaal bij AH")}{saving > 0.004 ? ' ' + t("· je bespaart {0}", [euro.format(saving)]) : bonusCount > 0 ? ' ' + t("· {0} in de bonus", [bonusCount]) : ''}
                    </p>
                    <p className="font-display text-xl font-bold tabular-nums text-primary-foreground">{euro.format(ahTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAhPrices}
                    disabled={pricing}
                    aria-label={t("AH-prijzen verversen")}
                    title={t("AH-prijzen verversen")}
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
                      <ShoppingBasket className="h-4 w-4" /> {t("In mandje")}
                    </a>
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{t('{0} van {1} gevonden', [pricedItems.length, voorAh.length])}</span>{' '}
                  {plus
                    ? t("· Je bestelt bij AH, in de app of op ah.nl.")
                    : t('· nog {0} van {1} gratis deze maand', [remaining('mandje'), FREE_LIMIT])}
                </p>
              </>
            ) : mandjeOp ? (
              // Op is op: één stille regel, geen knop die alleen nog "nee" kan zeggen.
              <div className="flex min-h-11 items-center gap-2">
                <p className="min-w-0 flex-1 text-[0.8125rem] text-muted-foreground">
                  {t('Je {0} gratis prijschecks van deze maand zijn gebruikt.', [FREE_LIMIT])}
                </p>
                <button
                  type="button"
                  onClick={() => setOverLimit(true)}
                  className="min-h-11 shrink-0 px-2 text-[0.8125rem] font-semibold text-primary"
                >
                  {t("Meer met Plus")}
                </button>
              </div>
            ) : (
              <>
                <Button type="button" onClick={fetchAhPrices} disabled={pricing} className="min-h-11 w-full gap-2">
                  {pricing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Prijzen zoeken…")}</>
                    : <><Tag className="h-4 w-4" /> {t("Bekijk wat het kost bij AH")}</>}
                </Button>
                {!plus && (
                  <p className="mt-1 text-center text-xs tabular-nums text-muted-foreground">
                    {t('Nog {0} van {1} gratis deze maand', [remaining('mandje'), FREE_LIMIT])}
                  </p>
                )}
              </>
            )}
            {PRIJSVERGELIJK_AAN && unchecked.length >= 2 && !mandjeOp && (
              <button
                type="button"
                onClick={() => setVergelijken(true)}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-border-strong bg-card text-sm font-semibold text-foreground transition-transform duration-150 ease-smooth active:scale-[.98]"
              >
                <Scale className="h-4 w-4" /> {t('Waar is dit het goedkoopst?')}
              </button>
            )}
          </div>
        </div>
      }
    </div>
  );
};

export default GroceryList;
