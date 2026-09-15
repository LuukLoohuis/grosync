import { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Merge, Tag, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { translateForSearch } from '@/lib/groceryTranslations';
import type { GroceryItem } from '@/types';

interface GroceryItemSheetProps {
  item: GroceryItem | null;
  /** De afdeling waar dit item onder staat, als bijschrift. */
  department?: string;
  onClose: () => void;
  onPickProduct: (id: string) => void;
}

const zoekterm = (name: string) =>
  encodeURIComponent(translateForSearch(name.replace(/^\d+(?:[.,]\d+)?\s+/, '')));

/** Alles wat je met één boodschap kunt doen, op één plek in plaats van in een menu. */
const GroceryItemSheet = ({ item, department, onClose, onPickProduct }: GroceryItemSheetProps) => {
  const { renameGroceryItem, removeGroceryItem, mergeDuplicateItems, groceryItems } = useAppContext();
  const [shown, setShown] = useState<GroceryItem | null>(item);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setName(item.name);
  }, [item]);

  if (!shown) return null;

  const dubbel = groceryItems.filter((row) => (
    !row.checked && row.id !== shown.id && row.name.trim().toLowerCase() === shown.name.trim().toLowerCase()
  )).length;

  const saveName = async () => {
    const typed = name.trim();
    if (!typed || typed === shown.name) return;
    await renameGroceryItem(shown.id, typed);
  };

  const rij = 'flex min-h-14 w-full items-center gap-3 border-t border-border px-1 text-left text-[0.9375rem] text-foreground';

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">{shown.name}</SheetTitle>
          <SheetDescription className="text-accent-ink">
            {[shown.fromRecipe ? `uit ${shown.fromRecipe}` : null, department].filter(Boolean).join(' · ') || 'Op je lijst'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <label htmlFor="boodschap-naam" className="mb-1 block text-sm text-muted-foreground">Naam</label>
          <Input
            id="boodschap-naam"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          {shown.ahProduct && (
            <p className="mt-1 text-xs text-muted-foreground">
              Wijzig je de naam, dan vervalt het gekozen AH-product.
            </p>
          )}
        </div>

        <div className="mt-4">
          {shown.ahProduct ? (
            <button type="button" onClick={() => { onClose(); onPickProduct(shown.id); }} className={rij}>
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {shown.ahProduct.title}
                {shown.ahProduct.isBonus && <span className="ml-2 font-semibold text-accent-ink">Bonus</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button type="button" onClick={() => { onClose(); onPickProduct(shown.id); }} className={rij}>
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">Product bij AH kiezen</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          {dubbel > 0 && (
            <button type="button" onClick={() => { onClose(); void mergeDuplicateItems(); }} className={rij}>
              <Merge className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">Samenvoegen met dubbel item</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          <a href={`https://www.ah.nl/zoeken?query=${zoekterm(shown.name)}`} target="_blank" rel="noopener noreferrer" className={rij}>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Zoek bij Albert Heijn</span>
          </a>
          <a href={`https://www.jumbo.com/producten/?searchTerms=${zoekterm(shown.name)}`} target="_blank" rel="noopener noreferrer" className={rij}>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Zoek bij Jumbo</span>
          </a>

          <button
            type="button"
            onClick={() => { onClose(); removeGroceryItem(shown.id); }}
            className={`${rij} text-destructive`}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">Weggooien</span>
          </button>
        </div>

        <Button className="mt-5 min-h-12 w-full" onClick={onClose}>Klaar</Button>
      </SheetContent>
    </Sheet>
  );
};

export default GroceryItemSheet;
