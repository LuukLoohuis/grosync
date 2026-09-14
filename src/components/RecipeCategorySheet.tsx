import { useEffect, useState } from 'react';
import { Settings2, Tags } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import CategoryPicker from '@/components/CategoryPicker';
import CategoryManager from '@/components/CategoryManager';
import { useAppContext } from '@/contexts/AppContext';
import type { Recipe } from '@/types';

interface RecipeCategorySheetProps {
  /** The recipe to label, or null when only the categories themselves are being managed. */
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

/** Puts a recipe in a category long after it was saved, and keeps the categories tidy. */
const RecipeCategorySheet = ({ recipe, open, onClose }: RecipeCategorySheetProps) => {
  const { updateRecipe } = useAppContext();
  // Keep showing the last recipe while the sheet slides away.
  const [lastRecipe, setLastRecipe] = useState<Recipe | null>(recipe);
  const shown = recipe ?? lastRecipe;
  const [categories, setCategories] = useState<string[]>([]);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    if (!recipe) return;
    setLastRecipe(recipe);
    setCategories(recipe.categories ?? []);
  }, [recipe]);

  useEffect(() => {
    if (open) setManaging(!recipe);
  }, [open, recipe]);

  // Every tap is saved right away, so closing the sheet never loses a choice.
  const change = (next: string[]) => {
    setCategories(next);
    if (recipe) void updateRecipe(recipe.id, { categories: next });
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] [@supports(height:100dvh)]:max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[20px]">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display text-xl">
            {managing ? 'Je categorieën' : 'Waar hoort dit bij?'}
          </SheetTitle>
          <SheetDescription>
            {managing ? 'Naam wijzigen, andere kleur kiezen of weggooien.' : shown?.name}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {managing ? <CategoryManager /> : <CategoryPicker value={categories} onChange={change} />}
        </div>

        {recipe && (
          <button
            type="button"
            onClick={() => setManaging((prev) => !prev)}
            className="mt-4 flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
          >
            {managing ? <><Tags className="h-4 w-4" /> Terug naar dit recept</> : <><Settings2 className="h-4 w-4" /> Categorieën beheren</>}
          </button>
        )}

        <Button className="mt-4 min-h-12 w-full" onClick={onClose}>Klaar</Button>
      </SheetContent>
    </Sheet>
  );
};

export default RecipeCategorySheet;
