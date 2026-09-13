import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/contexts/AppContext';
import { MAX_QUANTITY, sameProduct } from '@/lib/pantry';
import type { PantryItem } from '@/types';

interface PantryItemSheetProps {
  item: PantryItem | null;
  onClose: () => void;
  onAddToList: (name: string) => void;
}

/** Everything you can do with one jar, for the herbs that are too small for a row. */
const PantryItemSheet = ({ item, onClose, onAddToList }: PantryItemSheetProps) => {
  const { pantry, setPantryQuantity, setPantryLow, renamePantryItem, removePantryItem } = useAppContext();
  const [shown, setShown] = useState<PantryItem | null>(item);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setName(item.name);
  }, [item]);

  const live = item ? pantry.find((row) => row.id === item.id) ?? shown : shown;
  if (!live) return null;

  const saveName = async () => {
    const typed = name.trim();
    if (!typed || typed === live.name) return;
    if (pantry.some((other) => other.id !== live.id && sameProduct(other.name, typed))) {
      toast.error(`“${typed}” staat al in je kast`);
      setName(live.name);
      return;
    }
    await renamePantryItem(live.id, typed);
  };

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl first-letter:uppercase">{live.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="pantry-item-name" className="mb-1 block text-sm text-muted-foreground">Naam</label>
            <Input
              id="pantry-item-name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-border-strong">
              <button
                type="button"
                onClick={() => setPantryQuantity(live.id, live.quantity - 1)}
                disabled={live.quantity === 0}
                aria-label="Eén minder"
                className="flex h-12 w-12 items-center justify-center rounded-l-full text-foreground disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center font-display text-lg font-bold tabular-nums">{live.quantity}</span>
              <button
                type="button"
                onClick={() => setPantryQuantity(live.id, live.quantity + 1)}
                disabled={live.quantity >= MAX_QUANTITY}
                aria-label="Eén meer"
                className="flex h-12 w-12 items-center justify-center rounded-r-full text-foreground disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPantryLow(live.id, !live.low)}
              aria-pressed={live.low}
              className={`min-h-12 rounded-full px-4 font-display text-sm font-bold transition-colors duration-150 ease-smooth ${
                live.low ? 'bg-accent-soft text-accent-ink' : 'border border-border text-muted-foreground'
              }`}
            >
              Bijna op
            </button>
          </div>

          <div className="flex gap-2">
            <Button className="min-h-12 flex-1 gap-2" onClick={() => { onAddToList(live.name); onClose(); }}>
              <ShoppingCart className="h-4 w-4" /> Op je lijst
            </Button>
            <Button
              variant="outline"
              className="min-h-12 gap-2 text-destructive hover:text-destructive"
              onClick={() => { removePantryItem(live.id); onClose(); }}
            >
              <Trash2 className="h-4 w-4" /> Weg
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PantryItemSheet;
