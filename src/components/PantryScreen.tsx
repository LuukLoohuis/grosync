import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ListChecks, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DepartmentDot } from '@/components/DepartmentHeading';
import PantryTile from '@/components/PantryTile';
import SwipeToRemove from '@/components/SwipeToRemove';
import PantryScanSheet from '@/components/PantryScanSheet';
import PantryItemSheet from '@/components/PantryItemSheet';
import PlusSheet from '@/components/PlusSheet';
import UsualsList from '@/components/UsualsList';
import { useAppContext } from '@/contexts/AppContext';
import { isHerb, sameProduct } from '@/lib/pantry';
import { toSmallDataUrl } from '@/lib/photo';
import { sortByStoreRoute, type Department } from '@/lib/storeRouteSort';
import type { PantryItem } from '@/types';
import { FREE_LIMIT } from '@/hooks/useEntitlements';
import { QuotaError } from '@/services/functions';
import { scanPantryPhoto, type ScanHit } from '@/services/pantryApi';
import { locale, t } from '@/lib/i18n';

/** De eerste van de volgende maand, wanneer het tegoed weer vol staat. */
const resetDatum = () => {
  const nu = new Date();
  return new Date(nu.getFullYear(), nu.getMonth() + 1, 1).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
};

const dezeMaand = () => new Date().toLocaleDateString(locale(), { month: 'long' });

interface PantryScreenProps {
  onNavigate?: (tab: 'list') => void;
}

/** De voorraadkast: twee tegels breed, want dichtheid is hier het probleem. */
const PantryScreen = ({ onNavigate }: PantryScreenProps) => {
  const {
    pantry, pantryLoading, stockUp, removePantryItem, addGroceryItem, setPantryQuantity, setPantryState,
    plus, remaining, refreshEntitlements,
  } = useAppContext();

  const [adding, setAdding] = useState('');
  const [zoeken, setZoeken] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Department | 'kruiden' | 'bijna' | null>(null);
  // Bijwerken: één tik loopt door vol → bijna op → op. Weggooien doe je met een veeg.
  const [bijwerken, setBijwerken] = useState(false);
  useEffect(() => { if (pantry.length === 0) setBijwerken(false); }, [pantry.length]);
  const [overLimit, setOverLimit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const opGeraakt = !plus && remaining('kastfoto') === 0;

  const gezocht = useMemo(() => {
    const needle = zoekterm.trim().toLowerCase();
    return needle ? pantry.filter((item) => item.name.toLowerCase().includes(needle)) : pantry;
  }, [pantry, zoekterm]);

  const bijnaOp = gezocht.filter((item) => item.low || item.quantity === 0);
  const kruiden = gezocht.filter((item) => isHerb(item.name));
  const afdelingen = sortByStoreRoute(gezocht.filter((item) => !isHerb(item.name)));

  // Kruiden staan bovenaan, daarna de winkelafdelingen.
  const planken = [
    ...(kruiden.length > 0 ? [{ sleutel: 'kruiden' as const, label: 'Kruiden & specerijen', items: kruiden }] : []),
    ...afdelingen.map((groep) => ({ sleutel: groep.category, label: groep.label, items: groep.items })),
  ];
  const zichtbaar = filter === 'bijna'
    ? [{ sleutel: 'bijna' as const, label: t('Bijna op'), items: bijnaOp }]
    : filter
      ? planken.filter((plank) => plank.sleutel === filter)
      : planken;

  const openItem = pantry.find((item) => item.id === openItemId) ?? null;

  const weggooien = (id: string) => {
    void removePantryItem(id);
  };

  // Een kast past zelden in één foto, dus meerdere planken landen in één lijst.
  const takePhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setScanning(true);
    try {
      for (const file of Array.from(files)) {
        const image = await toSmallDataUrl(file);
        setHits(await scanPantryPhoto(image));
      }
      void refreshEntitlements();
    } catch (error) {
      if (error instanceof QuotaError) {
        setOverLimit(true);
        void refreshEntitlements();
      } else {
        console.error('Pantry scan failed:', error);
        toast.error(t("De foto lezen lukte niet. Probeer het nog eens."));
      }
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const scan = () => (opGeraakt ? setOverLimit(true) : fileInput.current?.click());

  const keep = async (names: string[], opIds: string[]) => {
    setHits(null);
    // Iets op een foto zien zegt dat het er staat, niet dat er eentje bij komt.
    for (const name of names) await stockUp(name, 'foto', false);
    // Wat er niet meer stond gaat op nul; de lijst pikt dat vanzelf op.
    for (const id of opIds) await setPantryQuantity(id, 0);
    const delen = [
      names.length > 0 ? t('{0} in de kast', [names.length]) : null,
      opIds.length > 0 ? t('{0} op je lijst', [opIds.length]) : null,
    ].filter(Boolean);
    if (delen.length > 0) toast.success(delen.join(' · '));
  };

  const addByHand = async () => {
    const name = adding.trim();
    if (!name) return;
    setAdding('');
    if (pantry.some((item) => sameProduct(item.name, name))) {
      toast(t("“{0}” staat er al in, er is er eentje bij gezet", [name]));
    }
    await stockUp(name, 'handmatig');
  };

  const toList = (name: string) => {
    addGroceryItem(name);
    toast.success(t("“{0}” op je lijst gezet", [name]), {
      action: onNavigate ? { label: t("Bekijken"), onClick: () => onNavigate('list') } : undefined,
    });
  };

  /** Eén tik verder in de rij: vol → bijna op → op → vol. */
  const volgendeStand = (item: PantryItem) => {
    const volgende = item.quantity === 0 ? 'vol' : item.low ? 'op' : 'bijna';
    void setPantryState(item.id, volgende);
  };

  const opTeller = pantry.filter((item) => item.quantity === 0).length;
  const bijnaTeller = pantry.filter((item) => item.low && item.quantity > 0).length;

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => takePhotos(e.target.files)}
      />

      {pantry.length > 0 && (
        <>
          <header className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">{t("Voorraad")}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pantry.length} {pantry.length === 1 ? t('product') : t('producten')}
                {bijnaTeller > 0 && t("· {0} bijna op", [bijnaTeller])}
                {opTeller > 0 && t("· {0} op", [opTeller])}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBijwerken((aan) => !aan)}
              aria-pressed={bijwerken}
              aria-label={bijwerken ? t('Klaar met bijwerken') : t('Voorraad bijwerken')}
              title={bijwerken ? t('Klaar met bijwerken') : t('Voorraad bijwerken')}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-150 ease-smooth ${
                bijwerken ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong text-foreground hover:bg-muted'
              }`}
            >
              {bijwerken ? <Check className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => { setZoeken((aan) => !aan); setZoekterm(''); }}
              aria-label={zoeken ? t("Zoeken sluiten") : t("Zoeken in je kast")}
              aria-pressed={zoeken}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-strong text-foreground transition-colors duration-150 ease-smooth hover:bg-muted"
            >
              {zoeken ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            <Button
              variant="secondary"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label={opGeraakt ? t("Je foto’s zijn op") : t("Kast scannen")}
              disabled={scanning}
              onClick={scan}
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
          </header>

          {bijwerken && (
            <p className="rounded-[12px] border border-primary/30 bg-primary-soft px-3 py-2 text-sm text-primary-deep">
              {t('Tik een potje om het bij te werken: vol → bijna op → op. Wat bijna op is, zet CoupleCart op je lijst.')}
            </p>
          )}

          {zoeken && (
            <Input
              autoFocus
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              placeholder={t("Zoek in je kast")}
              aria-label={t("Zoek in je kast")}
              className="bg-card font-body"
            />
          )}

          {/* Bijna op vooraan, daarna de planken. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex w-max items-center gap-2">
              {bijnaOp.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter(filter === 'bijna' ? null : 'bijna')}
                  aria-pressed={filter === 'bijna'}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[18px] border px-3 font-display text-xs font-semibold transition-colors duration-150 ease-smooth ${
                    filter === 'bijna'
                      ? 'border-accent bg-accent-soft text-accent-ink ring-1 ring-accent'
                      : 'border-accent/40 bg-accent-soft text-accent-ink'
                  }`}
                >
                  {t('Bijna op · {0}', [bijnaOp.length])}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
                className={`inline-flex h-9 items-center rounded-[18px] px-3 font-display text-xs font-semibold transition-colors duration-150 ease-smooth ${
                  filter === null ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t("Alles")}
              </button>
              {planken.map((plank) => (
                <button
                  key={plank.sleutel}
                  type="button"
                  onClick={() => setFilter(filter === plank.sleutel ? null : plank.sleutel)}
                  aria-pressed={filter === plank.sleutel}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-[18px] border px-3 font-display text-xs font-semibold transition-colors duration-150 ease-smooth ${
                    filter === plank.sleutel ? 'border-border-strong bg-muted text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
                  {plank.label.split(/[ ,]/)[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={t("Zelf iets toevoegen")}
              aria-label={t("Zelf iets toevoegen")}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addByHand()}
              className="bg-card font-body"
            />
            <Button onClick={addByHand} size="icon" className="h-11 w-11 shrink-0" aria-label={t("Toevoegen aan de kast")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {!plus && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {opGeraakt
                ? t("Kastfoto’s zijn op, op {0} staat je tegoed weer op {1}.", [resetDatum(), FREE_LIMIT])
                : t('Nog {0} van {1} kastfoto’s deze maand', [remaining('kastfoto'), FREE_LIMIT])}
            </p>
          )}
        </>
      )}

      {pantryLoading && (
        <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[46px] rounded-[12px]" />)}
        </div>
      )}

      {/* De uitleg over scannen woont hier, en nergens anders. */}
      {!pantryLoading && pantry.length === 0 && (
        <>
          <section className="rounded-[20px] border border-border bg-card p-5 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-[150px] w-full items-end justify-center rounded-[14px] border border-border p-2"
              style={{ backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted)) 0 4px, transparent 4px 8px)' }}
            >
              <span className="font-mono text-[0.625rem] text-muted-foreground">{t("foto · plank in beeld")}</span>
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-[-0.01em] text-foreground">{t("Maak een foto van je plank")}</h2>
            <p className="mx-auto mt-2 max-w-[20rem] text-sm text-muted-foreground">
              {t("CoupleCart leest welke producten erop staan. Je ziet eerst wat er herkend is en vinkt zelf af wat klopt.")}
            </p>
            <Button variant="secondary" className="mt-4 min-h-[50px] w-full gap-2" onClick={scan} disabled={scanning}>
              {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Foto lezen…")}</> : <><Camera className="h-4 w-4" /> {t("Foto maken")}</>}
            </Button>
            <Button variant="outline" className="mt-2 min-h-[50px] w-full" onClick={() => document.getElementById('kast-zelf-typen')?.focus()}>
              {t("Zelf typen")}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">{t("Vijf foto’s per maand gratis")}</p>
          </section>

          <p className="text-center text-xs text-muted-foreground">
            {t("Vink je iets af op je lijst? Dan zet CoupleCart het hier vanzelf bij.")}
          </p>

          <div className="flex gap-2">
            <Input
              id="kast-zelf-typen"
              placeholder={t("Zelf iets toevoegen")}
              aria-label={t("Zelf iets toevoegen")}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addByHand()}
              className="bg-card font-body"
            />
            <Button onClick={addByHand} size="icon" className="h-11 w-11 shrink-0" aria-label={t("Toevoegen aan de kast")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {zichtbaar.map((plank) => (
        <section key={plank.sleutel}>
          {plank.sleutel === 'bijna' ? (
            <h2 className="mb-1.5 mt-1.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-accent-ink">
              {t("Bijna op")}
            </h2>
          ) : (
            <DepartmentDot
              category={plank.sleutel as Department | 'kruiden'}
              label={plank.label}
              count={pantry.length >= 30 ? plank.items.length : undefined}
            />
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {plank.items.map((item) => (
              <SwipeToRemove key={item.id} label={item.name} onRemove={() => weggooien(item.id)}>
                <PantryTile
                  item={item}
                  bijwerken={bijwerken}
                  onOpen={() => (bijwerken ? volgendeStand(item) : setOpenItemId(item.id))}
                />
              </SwipeToRemove>
            ))}
          </div>
        </section>
      ))}

      {!pantryLoading && pantry.length > 0 && zichtbaar.every((plank) => plank.items.length === 0) && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("Niets gevonden.")}</p>
      )}

      <section>
        <h2 className="mb-2 font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">{t("Vaak gekocht")}</h2>
        <UsualsList />
      </section>

      <PantryScanSheet
        hits={hits}
        onClose={() => setHits(null)}
        onConfirm={keep}
        onAnotherPhoto={() => fileInput.current?.click()}
        scanning={scanning}
        known={pantry}
      />
      <PantryItemSheet item={openItem} onClose={() => setOpenItemId(null)} onAddToList={toList} />
      <PlusSheet feature={overLimit ? 'kastfoto' : null} onClose={() => setOverLimit(false)} />
    </div>
  );
};

export default PantryScreen;
