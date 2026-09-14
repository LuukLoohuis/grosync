import { useRef, useState } from 'react';
import { Camera, Loader2, Minus, Pencil, Plus, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import DepartmentHeading from '@/components/DepartmentHeading';
import PantryScanSheet from '@/components/PantryScanSheet';
import PantryItemSheet from '@/components/PantryItemSheet';
import UsualsList from '@/components/UsualsList';
import { useAppContext } from '@/contexts/AppContext';
import { MAX_QUANTITY, isHerb, sameProduct } from '@/lib/pantry';
import { toSmallDataUrl } from '@/lib/photo';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { scanPantryPhoto, type ScanHit } from '@/services/pantryApi';
import { QuotaError } from '@/services/functions';
import PlusSheet from '@/components/PlusSheet';
import { FREE_LIMIT } from '@/hooks/useEntitlements';
import type { PantryItem } from '@/types';

interface PantryScreenProps {
  onNavigate?: (tab: 'list') => void;
}

const PantryScreen = ({ onNavigate }: PantryScreenProps) => {
  const {
    pantry, pantryLoading, stockUp, setPantryQuantity, setPantryLow, renamePantryItem, removePantryItem,
    addGroceryItem, groceryItems, plus, remaining, refreshEntitlements,
  } = useAppContext();
  const [adding, setAdding] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [herbId, setHerbId] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onList = new Set(groceryItems.filter((i) => !i.checked).map((i) => i.name.trim().toLowerCase()));
  const herbs = pantry.filter((item) => isHerb(item.name));
  const departments = sortByStoreRoute(pantry.filter((item) => !isHerb(item.name)));
  const runningOut = pantry.filter((item) => item.low || item.quantity === 0);
  const herb = pantry.find((item) => item.id === herbId) ?? null;

  // A cupboard rarely fits in one frame, so several photos land in one list.
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

  const saveName = async (item: PantryItem) => {
    const typed = editing?.name.trim() ?? '';
    setEditing(null);
    if (!typed || typed === item.name) return;
    if (pantry.some((other) => other.id !== item.id && sameProduct(other.name, typed))) {
      toast.error(`“${typed}” staat al in je kast`);
      return;
    }
    await renamePantryItem(item.id, typed);
  };

  const row = (item: PantryItem) => (
    <li key={item.id} className="rounded-[12px] border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        {editing?.id === item.id ? (
          <Input
            autoFocus
            value={editing.name}
            maxLength={40}
            aria-label={`Naam van ${item.name}`}
            onChange={(e) => setEditing({ id: item.id, name: e.target.value })}
            onBlur={() => saveName(item)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing({ id: item.id, name: item.name })}
            aria-label={`${item.name} hernoemen`}
            className="flex min-h-11 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate text-[0.9375rem] text-foreground first-letter:uppercase">{item.name}</span>
            {item.quantity === 0 && <span className="shrink-0 text-xs font-semibold text-destructive">Op</span>}
            {/* The pencil says the name can be tapped; without it nobody tries. */}
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => removePantryItem(item.id)}
          aria-label={`${item.name} uit de kast halen`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-smooth hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <div className="flex items-center rounded-full border border-border-strong">
          <button
            type="button"
            onClick={() => setPantryQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity === 0}
            aria-label={`Eén ${item.name} minder`}
            className="flex h-11 w-11 items-center justify-center rounded-l-full text-foreground disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-8 text-center font-display text-[0.9375rem] font-bold tabular-nums text-foreground" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => setPantryQuantity(item.id, item.quantity + 1)}
            disabled={item.quantity >= MAX_QUANTITY}
            aria-label={`Eén ${item.name} meer`}
            className="flex h-11 w-11 items-center justify-center rounded-r-full text-foreground disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPantryLow(item.id, !item.low)}
          aria-pressed={item.low}
          className={`min-h-11 rounded-full px-3 font-display text-xs font-bold transition-colors duration-150 ease-smooth ${
            item.low ? 'bg-accent-soft text-accent-ink' : 'border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Bijna op
        </button>

        {(item.low || item.quantity === 0) && (
          <button
            type="button"
            onClick={() => toList(item.name)}
            disabled={onList.has(item.name.trim().toLowerCase())}
            aria-label={`${item.name} op je lijst zetten`}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-primary disabled:opacity-40"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );

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

      <section className="rounded-[14px] border border-border bg-accent-soft p-4">
        <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">Wat staat er in huis?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Maak een foto van een plank of van de koelkast. Je ziet eerst wat er herkend is, daarna gaat het pas de kast in.
        </p>
        <Button className="mt-3 min-h-12 w-full gap-2" onClick={() => fileInput.current?.click()} disabled={scanning}>
          {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Foto lezen…</> : <><Camera className="h-4 w-4" /> Kast scannen</>}
        </Button>
        {!plus && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Nog <span className="font-semibold tabular-nums text-foreground">{remaining('kastfoto')}</span> van {FREE_LIMIT} foto’s deze maand
          </p>
        )}
      </section>

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
      </div>

      {runningOut.length > 0 && (
        <section className="rounded-[14px] border border-border bg-card p-4">
          <h2 className="font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">Bijna op</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {runningOut.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toList(item.name)}
                disabled={onList.has(item.name.trim().toLowerCase())}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm text-foreground transition-colors duration-150 ease-smooth hover:bg-muted disabled:opacity-50"
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
            {herbs.map((item) => {
              const out = item.quantity === 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHerbId(item.id)}
                  aria-label={`${item.name} openen`}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-150 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    out
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : item.low
                        ? 'border-transparent bg-accent-soft text-accent-ink'
                        : 'border-border bg-card text-foreground hover:border-border-strong'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--cat-olijf))]" aria-hidden="true" />
                  <span className="first-letter:uppercase">{item.name}</span>
                  {item.quantity > 1 && <span className="text-xs tabular-nums opacity-70">×{item.quantity}</span>}
                  {out && <span className="text-xs font-semibold">op</span>}
                  {!out && item.low && <span className="text-xs font-semibold">bijna op</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {departments.map(({ category, label, items }) => (
        <section key={category}>
          <DepartmentHeading category={category} label={label} count={items.length} />
          <ul className="space-y-1">{items.map(row)}</ul>
        </section>
      ))}

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
      <PantryItemSheet item={herb} onClose={() => setHerbId(null)} onAddToList={toList} />
      <PlusSheet feature={overLimit ? 'kastfoto' : null} onClose={() => setOverLimit(false)} />
    </div>
  );
};

export default PantryScreen;
