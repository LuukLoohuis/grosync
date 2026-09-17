import { useState } from 'react';
import { useSheetSwipeClose } from '@/hooks/useSheetSwipeClose';
import { ExternalLink, Flame, Pencil, ShoppingCart, Tags, Trash2, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import CategoryChip from '@/components/CategoryChip';
import EstimateBadge from '@/components/EstimateBadge';
import { useAppContext } from '@/contexts/AppContext';
import { findCategory } from '@/lib/recipeCategories';
import { splitSteps } from '@/lib/recipeSteps';
import { isEstimated, withoutEstimate } from '@/lib/recipeImport';
import type { Recipe } from '@/types';
import { t } from '@/lib/i18n';

interface RecipeDetailSheetProps {
  recipe: Recipe | null;
  onClose: () => void;
  onAddToList: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onMacros: (recipe: Recipe) => void;
  onCategories: (recipe: Recipe) => void;
}

/** The whole recipe, one swipe away from the grid. */
const RecipeDetailSheet = ({ recipe, onClose, onAddToList, onEdit, onMacros, onCategories }: RecipeDetailSheetProps) => {
  const { recipeCategories, removeRecipe } = useAppContext();
  const [shown, setShown] = useState<Recipe | null>(recipe);
  // Keep showing the recipe while the sheet slides away.
  if (recipe && recipe !== shown) setShown(recipe);
  const open = Boolean(recipe);
  const servings = shown?.servings || 4;
  const steps = splitSteps(shown?.instructions);
  const { velProps, scrollRef } = useSheetSwipeClose(onClose);

  const act = (run: (recipe: Recipe) => void) => {
    if (!shown) return;
    onClose();
    run(shown);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        {...velProps}
        className="mx-auto flex max-h-[92vh] [@supports(height:100dvh)]:max-h-[92dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-t-[20px] p-0"
      >
        {/* Een greepje: hieraan trek je het vel naar beneden. */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-2 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/25"
        />
        {shown?.imageUrl && (
          <div className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-t-[20px] bg-muted">
            <img src={shown.imageUrl} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}

        <SheetHeader className="shrink-0 px-5 pb-3 pr-14 pt-5 text-left">
          <SheetTitle className="font-display text-xl leading-tight">{shown?.name}</SheetTitle>
          {shown?.description && <SheetDescription>{shown.description}</SheetDescription>}
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(shown?.categories ?? []).map((label) => {
              const category = findCategory(recipeCategories, label);
              return <CategoryChip key={label} name={category.name} color={category.color} />;
            })}
            <button
              type="button"
              onClick={() => act(onCategories)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-2 font-display text-[0.6875rem] font-bold text-muted-foreground"
            >
              <Tags className="h-3 w-3" /> {t("Categorie")}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <h3 className="font-display text-[0.9375rem] font-bold text-foreground">{t("Ingrediënten")}</h3>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> voor {servings}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {(shown?.ingredients ?? []).map((ingredient, index) => (
              <li key={index} className="flex items-start gap-2 text-[0.9375rem] text-foreground/90">
                <span className="mt-0.5 text-primary">•</span>
                <span>{withoutEstimate(ingredient)}{isEstimated(ingredient) && <EstimateBadge />}</span>
              </li>
            ))}
          </ul>

          {steps.length > 0 && (
            <>
              <h3 className="mt-5 font-display text-[0.9375rem] font-bold text-foreground">{t("Bereiding")}</h3>
              <ol className="mt-2 space-y-3">
                {steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xs font-bold tabular-nums text-primary"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="text-[0.9375rem] leading-relaxed text-foreground/90">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {shown?.sourceUrl && (
            <a
              href={shown.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("Origineel bekijken")}
            </a>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-auto min-h-12 flex-col gap-1 px-1 py-2 text-[11px] font-medium" onClick={() => act(onEdit)}>
              <Pencil className="h-4 w-4" /> {t("Bewerken")}
            </Button>
            <Button variant="outline" className="h-auto min-h-12 flex-col gap-1 px-1 py-2 text-[11px] font-medium" onClick={() => act(onMacros)}>
              <Flame className="h-4 w-4" /> {t("Voedingswaarden")}
            </Button>
            <Button
              variant="outline"
              className="h-auto min-h-12 flex-col gap-1 px-1 py-2 text-[11px] font-medium text-destructive hover:text-destructive"
              onClick={() => act((item) => removeRecipe(item.id))}
            >
              <Trash2 className="h-4 w-4" /> {t("Verwijderen")}
            </Button>
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="min-h-12 w-full gap-2" onClick={() => act(onAddToList)}>
            <ShoppingCart className="h-4 w-4" /> {t("Zet op je lijst")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RecipeDetailSheet;
