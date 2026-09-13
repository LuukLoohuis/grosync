import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import CategoryPicker from '@/components/CategoryPicker';
import { useAppContext } from '@/contexts/AppContext';
import type { Recipe } from '@/types';

interface RecipeCategorySheetProps {
  recipe: Recipe | null;
  onClose: () => void;
}

/** Puts a recipe in a category long after it was saved, without opening the whole form. */
const RecipeCategorySheet = ({ recipe, onClose }: RecipeCategorySheetProps) => {
  const { updateRecipe } = useAppContext();
  // Keep showing the last recipe while the sheet slides away.
  const [lastRecipe, setLastRecipe] = useState<Recipe | null>(recipe);
  const shown = recipe ?? lastRecipe;
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!recipe) return;
    setLastRecipe(recipe);
    setCategories(recipe.categories ?? []);
  }, [recipe]);

  // Every tap is saved right away, so closing the sheet never loses a choice.
  const change = (next: string[]) => {
    setCategories(next);
    if (shown) void updateRecipe(shown.id, { categories: next });
  };

  return (
    <Sheet open={Boolean(recipe)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Waar hoort dit bij?</SheetTitle>
          <SheetDescription>{shown?.name}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <CategoryPicker value={categories} onChange={change} />
        </div>
        <Button className="mt-6 w-full min-h-12" onClick={onClose}>Klaar</Button>
      </SheetContent>
    </Sheet>
  );
};

export default RecipeCategorySheet;
