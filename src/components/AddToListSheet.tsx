import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import EstimateBadge from '@/components/EstimateBadge';
import { useAppContext } from '@/contexts/AppContext';
import { isPantryStaple } from '@/lib/pantryStaples';
import { isEstimated, withoutEstimate } from '@/lib/recipeImport';
import { scaleIngredient } from '@/lib/scaleIngredient';
import type { Recipe } from '@/types';
import { t } from '@/lib/i18n';

interface AddToListSheetProps {
  recipe: Recipe | null;
  onClose: () => void;
  onNavigate?: (tab: 'list') => void;
}

const personen = (count: number) => `${count} ${count === 1 ? t('persoon') : t('personen')}`;

const AddToListSheet = ({ recipe, onClose, onNavigate }: AddToListSheetProps) => {
  const { addRecipeToGroceryList, pantryStaples } = useAppContext();
  // Keep showing the last recipe while the sheet slides away.
  const [lastRecipe, setLastRecipe] = useState<Recipe | null>(recipe);
  const shown = recipe ?? lastRecipe;
  const baseServings = shown?.servings || 4;
  const [servings, setServings] = useState(baseServings);
  const [unchecked, setUnchecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Basics you probably have go last and start unchecked.
  const rows = useMemo(() => {
    const all = (shown?.ingredients ?? []).map((ingredient, index) => ({
      index,
      ingredient,
      staple: isPantryStaple(withoutEstimate(ingredient), pantryStaples),
    }));
    return { needed: all.filter((row) => !row.staple), basics: all.filter((row) => row.staple) };
  }, [shown, pantryStaples]);

  useEffect(() => {
    if (!recipe) return;
    setLastRecipe(recipe);
    setServings(recipe.servings || 4);
    setUnchecked(new Set(rows.basics.map((row) => row.index)));
    // Reset when a recipe opens, not when it updates or the staples finish loading mid-choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  const multiplier = servings / baseServings;
  const lineFor = (ingredient: string) => scaleIngredient(withoutEstimate(ingredient), multiplier);
  const chosen = [...rows.needed, ...rows.basics].filter((row) => !unchecked.has(row.index));
  const itemsLabel = `${chosen.length} ${chosen.length === 1 ? t('item') : t('items')}`;

  const toggle = (index: number, checked: boolean) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(index);
      else next.add(index);
      return next;
    });

  const addToList = async () => {
    if (!shown || chosen.length === 0) return;
    setSaving(true);
    const added = await addRecipeToGroceryList(chosen.map((row) => lineFor(row.ingredient)), shown.name);
    setSaving(false);
    if (!added) {
      toast.error(t("Op je lijst zetten lukte niet. Probeer het opnieuw."));
      return;
    }
    onClose();
    toast.success(
      t('{0} op je lijst gezet', [itemsLabel]),
      onNavigate ? { action: { label: t("Bekijk lijst"), onClick: () => onNavigate('list') } } : undefined,
    );
  };

  const renderRow = ({ index, ingredient }: { index: number; ingredient: string }) => (
    <li key={index}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
        <Checkbox checked={!unchecked.has(index)} onCheckedChange={(value) => toggle(index, value === true)} />
        <span className="text-sm leading-snug text-foreground">
          {lineFor(ingredient)}
          {isEstimated(ingredient) && <EstimateBadge />}
        </span>
      </label>
    </li>
  );

  return (
    <Sheet open={Boolean(recipe)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90vh] [@supports(height:100dvh)]:max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
        {shown && (
          <>
            <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
              <SheetTitle className="font-display text-xl">{t("Wat moet je halen?")}</SheetTitle>
              <SheetDescription className="truncate">{shown.name}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="flex items-center justify-between rounded-lg bg-muted pl-3">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {t('Voor {0}', [personen(servings)])}
                </span>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setServings((count) => Math.max(1, count - 1))}
                    disabled={servings <= 1}
                    aria-label={t("Minder personen")}
                    className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-background disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setServings((count) => count + 1)}
                    aria-label={t("Meer personen")}
                    className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-background"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 min-h-4 text-xs text-muted-foreground" aria-live="polite">
                {servings !== baseServings && t("Aangepast van {0} naar {1}", [baseServings, personen(servings)])}
              </p>

              <ul className="mt-1">{rows.needed.map(renderRow)}</ul>

              {rows.basics.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-muted-foreground">{t("Heb je waarschijnlijk al")}</h3>
                  <ul className="mt-1">{rows.basics.map(renderRow)}</ul>
                </>
              )}
            </div>

            <div className="border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button className="min-h-11 w-full" onClick={addToList} disabled={chosen.length === 0 || saving}>
                {t('Zet {0} op je lijst', [itemsLabel])}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AddToListSheet;
