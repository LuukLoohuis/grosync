import { useRef, useState } from 'react';
import { Camera, Loader2, Plus, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import DepartmentHeading from '@/components/DepartmentHeading';
import PantryScanSheet from '@/components/PantryScanSheet';
import UsualsList from '@/components/UsualsList';
import { useAppContext } from '@/contexts/AppContext';
import { LEVEL_LABEL, LEVEL_TINT, nextLevel, sameProduct } from '@/lib/pantry';
import { toSmallDataUrl } from '@/lib/photo';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import { scanPantryPhoto, type ScanHit } from '@/services/pantryApi';

interface PantryScreenProps {
  onNavigate?: (tab: 'list') => void;
}

const PantryScreen = ({ onNavigate }: PantryScreenProps) => {
  const { pantry, pantryLoading, stockUp, setPantryLevel, removePantryItem, addGroceryItem, groceryItems } = useAppContext();
  const [adding, setAdding] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onList = new Set(groceryItems.filter((i) => !i.checked).map((i) => i.name.trim().toLowerCase()));
  const departments = sortByStoreRoute(pantry);
  const runningLow = pantry.filter((item) => item.level !== 'ruim');

  const takePhoto = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    try {
      const image = await toSmallDataUrl(file);
      const found = await scanPantryPhoto(image);
      setHits(found);
    } catch (error) {
      console.error('Pantry scan failed:', error);
      toast.error('De foto lezen lukte niet. Probeer het nog eens.');
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const keep = async (names: string[]) => {
    setHits(null);
    for (const name of names) await stockUp(name, 'ruim', 'foto');
    toast.success(names.length === 1 ? '1 product in de kast' : `${names.length} producten in de kast`);
  };

  const addByHand = async () => {
    const name = adding.trim();
    if (!name) return;
    setAdding('');
    if (pantry.some((item) => sameProduct(item.name, name))) {
      toast(`“${name}” staat er al in`);
      return;
    }
    await stockUp(name, 'ruim', 'handmatig');
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
        className="sr-only"
        onChange={(e) => takePhoto(e.target.files?.[0])}
      />

      <section className="rounded-[14px] border border-border bg-accent-soft p-4">
        <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">Wat staat er in huis?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Maak een foto van een plank of van de koelkast. Je ziet eerst wat er herkend is, daarna gaat het pas de kast in.
        </p>
        <Button className="mt-3 min-h-12 w-full gap-2" onClick={() => fileInput.current?.click()} disabled={scanning}>
          {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Foto lezen…</> : <><Camera className="h-4 w-4" /> Kast scannen</>}
        </Button>
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

      {runningLow.length > 0 && (
        <section className="rounded-[14px] border border-border bg-card p-4">
          <h2 className="font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">Bijna op</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {runningLow.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toList(item.name)}
                disabled={onList.has(item.name.trim().toLowerCase())}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm text-foreground transition-colors duration-150 ease-smooth hover:bg-muted disabled:opacity-50"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="first-letter:uppercase">{item.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tik om op je lijst te zetten.</p>
        </section>
      )}

      {pantryLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-[12px]" />)}
        </div>
      )}

      {!pantryLoading && pantry.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Je kast is nog leeg. Scan een plank, of typ hierboven wat je in huis hebt.
        </p>
      )}

      {departments.map(({ category, label, items }) => (
        <section key={category}>
          <DepartmentHeading category={category} label={label} count={items.length} />
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-1.5">
                <span className="flex-1 truncate text-[0.9375rem] text-foreground first-letter:uppercase">{item.name}</span>
                <button
                  type="button"
                  onClick={() => setPantryLevel(item.id, nextLevel(item.level))}
                  aria-label={`${item.name} is nu ${LEVEL_LABEL[item.level]}, tik om te wijzigen`}
                  className={`min-h-11 shrink-0 rounded-full px-3 font-display text-xs font-bold ${LEVEL_TINT[item.level]}`}
                >
                  {LEVEL_LABEL[item.level]}
                </button>
                <button
                  type="button"
                  onClick={() => removePantryItem(item.id)}
                  aria-label={`${item.name} uit de kast halen`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="mb-2 font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-foreground">Vaak gekocht</h2>
        <UsualsList />
      </section>

      <PantryScanSheet hits={hits} onClose={() => setHits(null)} onConfirm={keep} />
    </div>
  );
};

export default PantryScreen;
