import { useEffect, useState } from 'react';
import { ChevronRight, Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/contexts/AppContext';
import { DEPARTMENT_DOT } from '@/components/DepartmentHeading';
import { MAX_QUANTITY, isHerb, sameProduct } from '@/lib/pantry';
import { sortByStoreRoute } from '@/lib/storeRouteSort';
import type { PantryItem } from '@/types';
import { t } from '@/lib/i18n';

interface PantryItemSheetProps {
  item: PantryItem | null;
  onClose: () => void;
  onAddToList: (name: string) => void;
}

/** De afdeling waar dit product onder staat, voor de stip en het bijschrift. */
const plankVan = (item: PantryItem) => {
  if (isHerb(item.name)) return { sleutel: 'kruiden' as const, label: 'Kruiden & specerijen' };
  const groep = sortByStoreRoute([item])[0];
  return { sleutel: groep.category, label: groep.label };
};

/**
 * Alles wat je met één product kunt doen. Bewust niet wat de tegel al laat zien:
 * hier verander je het, daar lees je het.
 */
const PantryItemSheet = ({ item, onClose, onAddToList }: PantryItemSheetProps) => {
  const { pantry, setPantryQuantity, setPantryLow, renamePantryItem, removePantryItem } = useAppContext();
  const [shown, setShown] = useState<PantryItem | null>(item);
  const [hernoemen, setHernoemen] = useState(false);
  const [naam, setNaam] = useState('');

  useEffect(() => {
    if (!item) return;
    setShown(item);
    setNaam(item.name);
    setHernoemen(false);
  }, [item]);

  const live = item ? pantry.find((row) => row.id === item.id) ?? shown : shown;
  if (!live) return null;

  const plank = plankVan(live);

  const bewaarNaam = async () => {
    const getypt = naam.trim();
    setHernoemen(false);
    if (!getypt || getypt === live.name) return;
    if (pantry.some((row) => row.id !== live.id && sameProduct(row.name, getypt))) {
      toast.error(t("“{0}” staat al in je kast", [getypt]));
      setNaam(live.name);
      return;
    }
    await renamePantryItem(live.id, getypt);
  };

  const rij = 'flex w-full items-center gap-3 border-t border-border px-1 text-left';

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetDescription className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${DEPARTMENT_DOT[plank.sleutel]}`} aria-hidden="true" />
            {plank.label}
          </SheetDescription>
          <SheetTitle className="font-display text-[1.375rem] font-bold first-letter:uppercase">{live.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <div className={`${rij} min-h-[60px] justify-between`}>
            <span className="text-[0.9375rem] text-foreground">{t("Aantal")}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPantryQuantity(live.id, live.quantity - 1)}
                disabled={live.quantity === 0}
                aria-label={t("Eén minder")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong text-foreground disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center font-display text-[1.1875rem] font-bold tabular-nums text-foreground">
                {live.quantity}
              </span>
              <button
                type="button"
                onClick={() => setPantryQuantity(live.id, live.quantity + 1)}
                disabled={live.quantity >= MAX_QUANTITY}
                aria-label={t("Eén meer")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong text-foreground disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={`${rij} min-h-[56px] justify-between`}>
            <span className="min-w-0">
              <span className="block text-[0.9375rem] text-foreground">{t("Bijna op")}</span>
              <span className="block text-xs text-muted-foreground">{t("Zet hem in de bijna-op-rij")}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={live.low}
              aria-label={t("Bijna op")}
              onClick={() => setPantryLow(live.id, !live.low)}
              className={`relative h-[31px] w-[52px] shrink-0 rounded-full transition-colors duration-150 ease-smooth ${
                live.low ? 'bg-accent' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-[3px] h-[25px] w-[25px] rounded-full bg-card shadow-flat transition-[left] duration-150 ease-smooth ${
                  live.low ? 'left-[24px]' : 'left-[3px]'
                }`}
              />
            </button>
          </div>

          {hernoemen ? (
            <div className={`${rij} min-h-[56px] gap-2 py-2`}>
              <Input
                autoFocus
                value={naam}
                maxLength={40}
                aria-label={t("Naam van {0}", [live.name])}
                onChange={(e) => setNaam(e.target.value)}
                onBlur={bewaarNaam}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setHernoemen(true)} className={`${rij} min-h-[56px]`}>
              <span className="flex-1 text-[0.9375rem] text-foreground">{t("Naam wijzigen")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          <button
            type="button"
            onClick={() => { onClose(); removePantryItem(live.id); }}
            className={`${rij} min-h-[56px] text-destructive`}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t("Weggooien")}</span>
          </button>
        </div>

        <Button className="mt-5 min-h-[50px] w-full" onClick={() => { onAddToList(live.name); onClose(); }}>
          {t("Op de lijst zetten")}
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default PantryItemSheet;
