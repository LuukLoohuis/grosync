import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Plus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import DepartmentHeading from '@/components/DepartmentHeading';
import PantryChip from '@/components/PantryChip';
import SwipeToRemove from '@/components/SwipeToRemove';
import PantryScanSheet from '@/components/PantryScanSheet';
import PantryItemSheet from '@/components/PantryItemSheet';
import UsualsList from '@/components/UsualsList';
import { useAppContext } from '@/contexts/AppContext';
import { isHerb, sameProduct } from '@/lib/pantry';
import { toSmallDataUrl } from '@/lib/photo';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { scanPantryPhoto, type ScanHit } from '@/services/pantryApi';
import { QuotaError } from '@/services/functions';
import PlusSheet from '@/components/PlusSheet';
import { FREE_LIMIT } from '@/hooks/useEntitlements';

const HINT_KEY = 'couplecart-veeg-hint';

/** Hoe vaak het potje al even opzij is gewipt; na drie keer weet je het wel. */
const hintStand = () => {
  try { return Number(window.localStorage.getItem(HINT_KEY) ?? 0); } catch { return 99; }
};

const hintOnthouden = (waarde: number) => {
  try { window.localStorage.setItem(HINT_KEY, String(waarde)); } catch { /* privémodus: dan maar geen hint */ }
};

/** De eerste van de volgende maand, wanneer het tegoed weer vol staat. */
const resetDatum = () => {
  const nu = new Date();
  return new Date(nu.getFullYear(), nu.getMonth() + 1, 1).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
};

interface PantryScreenProps {
  onNavigate?: (tab: 'list') => void;
}

const PantryScreen = ({ onNavigate }: PantryScreenProps) => {
  const {
    pantry, pantryLoading, stockUp, removePantryItem, addGroceryItem, groceryItems, plus, remaining, refreshEntitlements,
  } = useAppContext();
  const [adding, setAdding] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onList = new Set(groceryItems.filter((i) => !i.checked).map((i) => i.name.trim().toLowerCase()));
  const herbs = pantry.filter((item) => isHerb(item.name));
  // Het eerste potje op het scherm doet het voor.
  const eersteId = (herbs[0] ?? pantry.find((item) => !isHerb(item.name)))?.id;
  const departments = sortByStoreRoute(pantry.filter((item) => !isHerb(item.name)));
  const runningOut = pantry.filter((item) => item.low || item.quantity === 0);
  const openItem = pantry.find((item) => item.id === openItemId) ?? null;
  const opGeraakt = !plus && remaining('kastfoto') === 0;

  // Eén keer per bezoek tellen, hoogstens drie bezoeken lang voordoen.
  const [toonHint, setToonHint] = useState(false);
  const geteld = useRef(false);

  useEffect(() => {
    if (geteld.current || pantry.length === 0) return;
    geteld.current = true;
    const stand = hintStand();
    if (stand >= 3) return;
    hintOnthouden(stand + 1);
    setToonHint(true);
  }, [pantry.length]);

  /** Wie één keer geveegd heeft, hoeft het nooit meer voorgedaan te krijgen. */
  const weggooien = (id: string) => {
    hintOnthouden(3);
    setToonHint(false);
    void removePantryItem(id);
  };

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
        toast.error('De foto lezen lukte niet. Probeer het nog eens.');
      }
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const keep = async (names: string[]) => {
    setHits(null);
    // Seeing something on a shelf says it is there, not that there is one more of it.
    for (const name of names) await stockUp(name, 'foto', false);
    toast.success(names.length === 1 ? '1 product in de kast' : `${names.length} producten in de kast`);
  };

  const addByHand = async () => {
    const name = adding.trim();
    if (!name) return;
    setAdding('');
    if (pantry.some((item) => sameProduct(item.name, name))) {
      toast(`“${name}” staat er al in, er is er eentje bij gezet`);
    }
    await stockUp(name, 'handmatig');
  };

  const toList = (name: string) => {
    addGroceryItem(name);
    toast.success(`“${name}” op je lijst gezet`, {
      action: onNavigate ? { label: 'Bekijken', onClick: () => onNavigate('list') } : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => takePhotos(e.target.files)}
      />

      {/* Een volle kast heeft geen uitleg meer nodig; dan is scannen gewoon een knop. */}
      {pantry.length === 0 ? (
        <section className="rounded-[14px] border border-border bg-accent-soft p-4">
          <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">Wat staat er in huis?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Maak een foto van een plank of van de koelkast. Je ziet eerst wat er herkend is, daarna gaat het pas de kast in.
          </p>
          <Button
            className="mt-3 min-h-12 w-full gap-2"
            onClick={() => (opGeraakt ? setOverLimit(true) : fileInput.current?.click())}
            disabled={scanning}
          >
            {scanning
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Foto lezen…</>
              : <><Camera className="h-4 w-4" /> {opGeraakt ? 'Je foto’s zijn op' : 'Kast scannen'}</>}
          </Button>
        </section>
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="flex-1 text-sm text-muted-foreground">
            <span className="font-display font-bold tabular-nums text-foreground">{pantry.length}</span> in huis
            {runningOut.length > 0 && (
              <>
                {' · '}
                <span className="font-display font-bold tabular-nums text-accent-ink">{runningOut.length}</span> bijna op
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Zelf iets toevoegen"
          aria-label="Zelf iets toevoegen"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addByHand()}
          className="bg-card font-body"
        />
        <Button onClick={addByHand} size="icon" className="h-11 w-11 shrink-0" aria-label="Toevoegen aan de kast">
          <Plus className="h-4 w-4" />
        </Button>
        {pantry.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={opGeraakt ? 'Je foto’s zijn op' : 'Kast scannen'}
            disabled={scanning}
            onClick={() => (opGeraakt ? setOverLimit(true) : fileInput.current?.click())}
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {!plus && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {opGeraakt
            ? `Kastfoto’s zijn op, op ${resetDatum()} staat je tegoed weer op ${FREE_LIMIT}.`
            : <>Nog <span className="font-semibold tabular-nums text-foreground">{remaining('kastfoto')}</span> van {FREE_LIMIT} kastfoto’s deze maand</>}
        </p>
      )}

      {runningOut.length > 0 && (
        <section className="rounded-[14px] border border-accent/25 bg-accent-soft p-4">
          <h2 className="font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">Bijna op</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {runningOut.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toList(item.name)}
                disabled={onList.has(item.name.trim().toLowerCase())}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent/30 bg-card px-3.5 text-sm text-foreground transition-colors duration-150 ease-smooth hover:border-accent disabled:opacity-50"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="first-letter:uppercase">{item.name}</span>
                {item.quantity === 0 && <span className="text-xs font-semibold text-destructive">op</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tik om op je lijst te zetten.</p>
        </section>
      )}

      {pantryLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-[12px]" />)}
        </div>
      )}

      {!pantryLoading && pantry.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Je kast is nog leeg. Scan een plank, of typ hierboven wat je in huis hebt.
        </p>
      )}

      {herbs.length > 0 && (
        <section>
          <DepartmentHeading category="kruiden" label="Kruiden & specerijen" count={herbs.length} />
          {/* A spice rack, not a stack of rows: nobody counts jars of oregano. */}
          <div className="flex flex-wrap gap-2">
            {herbs.map((item) => (
              <SwipeToRemove key={item.id} label={item.name} onRemove={() => weggooien(item.id)} nudge={toonHint && item.id === eersteId}>
                <PantryChip item={item} shelf="kruiden" onOpen={() => setOpenItemId(item.id)} />
              </SwipeToRemove>
            ))}
          </div>
        </section>
      )}

      {departments.map(({ category, label, items }) => (
        <section key={category}>
          <DepartmentHeading category={category} label={label} count={items.length} />
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <SwipeToRemove key={item.id} label={item.name} onRemove={() => weggooien(item.id)} nudge={toonHint && item.id === eersteId}>
                <PantryChip item={item} shelf={category} onOpen={() => setOpenItemId(item.id)} />
              </SwipeToRemove>
            ))}
          </div>
        </section>
      ))}

      {toonHint && (
        <p className="text-xs text-muted-foreground">Veeg een potje naar links om het weg te gooien.</p>
      )}

      <section>
        <h2 className="mb-2 font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">Vaak gekocht</h2>
        <UsualsList />
      </section>

      <PantryScanSheet
        hits={hits}
        onClose={() => setHits(null)}
        onConfirm={keep}
        onAnotherPhoto={() => fileInput.current?.click()}
        scanning={scanning}
        known={pantry.map((item) => item.name)}
      />
      <PantryItemSheet item={openItem} onClose={() => setOpenItemId(null)} onAddToList={toList} />
      <PlusSheet feature={overLimit ? 'kastfoto' : null} onClose={() => setOverLimit(false)} />
    </div>
  );
};

export default PantryScreen;
